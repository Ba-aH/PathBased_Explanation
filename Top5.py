import re
import unicodedata
import networkx as nx
import random
from rdflib import Graph


g = Graph()
input_file = "combined_graph.ttl"
g.parse(input_file, format="ttl")

G = nx.DiGraph()
for s,p,o in g:
    G.add_edge(str(s), str(o), predicate =str(p))

def normalize_label(val):
    """
    Transforme une URI ou un littéral en label normalisé :
    - Extrait le dernier fragment si URI
    - Convertit en minuscule
    - Remplace les tirets, underscores, et camelCase par des espaces
    - Supprime accents et ponctuations
    - Trim des espaces

    Retourne un str.
    """
    val = str(val)

    # Si c'est une URI avec <...>, on l'enlève
    if val.startswith("<") and val.endswith(">"):
        val = val[1:-1]

    # Garde le dernier fragment d'URI
    if "/" in val:
        val = val.rsplit("/", 1)[-1]

    # Remplace underscore, tirets, etc.
    val = re.sub(r"[_\-]", " ", val)

    # Sépare camelCase → camel case
    val = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", val)

    # Supprime accents
    val = unicodedata.normalize('NFKD', val).encode('ASCII', 'ignore').decode('utf-8')

    # Tout en minuscules + trim
    val = val.lower().strip()

    # Optionnel : collapse multiple spaces
    val = re.sub(r"\s+", " ", val)

    return val

def find_top5(G, user, course):
  """
  Permet de récupérer le top 5 des attributs sémantiques communs entre un cours recommandé et les cours HighInterest d'un utilisateur.
  Retourne un dico où les clés sont les attributs sémantiques et les valeurs sont les taux de similarité de ceux-ci.
  """
  # On récupère le nombre de cours pour lequel l'utilisateur a un high Interest
  tot_query = f"""
  SELECT (COUNT(?coursOK) AS ?tot) WHERE {{
    {user} <https://coursera.graph.edu/HighInterest> ?coursOK .
  }}
  """
  res = g.query(tot_query)
  tot = None
  for row in res:
      # On convertit le résultat en flottant
      tot = float(row.tot)
      break
  if tot is None or tot == 0:
    print("Utilisateur sans cours préférés — division impossible.")
  else:
    top5_query=f"""
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

    SELECT ?p (COUNT(DISTINCT ?coursMatch) AS ?nbCommun)
    WHERE {{

      # Triplets (p,o) du cours recommandé
      {course} ?p ?o .
      FILTER(?p != rdf:type && ?o != <https://schema.org/LearningResource>)

      # Cours préférés avec même (p,o)
      {user} <https://coursera.graph.edu/HighInterest> ?coursMatch .
      ?coursMatch ?p ?o .
    }}
    GROUP BY ?p
    ORDER BY DESC(?nbCommun)
    LIMIT 5
    """
    tres = g.query(top5_query)
    top5 ={}
    for row in tres:
        # On normalise chaque label et on le simplifie pour certains attributs sémantiques
        label = normalize_label(row.p)
        if label == "has knowledge topic":
           label="knowledge topic"
        if label == "has difficulty level":
          label = "difficulty level"
        if label == "creator":
           label ="university"
        top5[label] = float(float(row.nbCommun)/tot)
    return top5

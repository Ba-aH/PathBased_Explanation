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

#<https://coursera.graph.edu/user_619.0>
#<https://coursera.graph.edu/course_209>

def find_top5(G, user, course):
  tot_query = f"""
  SELECT (COUNT(?coursOK) AS ?tot) WHERE {{
    {user} <https://coursera.graph.edu/HighInterest> ?coursOK .
  }}
  """
  res = g.query(tot_query)
  tot = None
  for row in res:
      tot = float(row.tot)  # ou float si besoin
      break
  if tot == 0:
    print("Utilisateur sans cours préférés — division impossible.")
  else:
    top5_query=f"""
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

      SELECT ?att (xsd:decimal(COALESCE(?nbCommun, 0)) / {tot} AS ?pourcentage) WHERE {{
        #1. On récupère tous les attributs du cours
        {course} ?p ?att .
        Filter(?att != <https://schema.org/LearningResource>)

  
        # 2. Pour chaque attribut ?att, on compte combien de cours préférés l'ont aussi
        OPTIONAL {{
            SELECT ?att (COUNT(?coursSimil) AS ?nbCommun) WHERE {{
              {user} <https://coursera.graph.edu/HighInterest> ?coursSimil .
              ?coursSimil ?p ?att .
            }}
            GROUP BY ?att
          }}
      }}
      ORDER BY DESC(?pourcentage)
      LIMIT 5"""
    tres = g.query(top5_query)
    top5 ={}
    for row in tres:
        label = normalize_label(row.att)
        top5[label] = float(row.pourcentage)
    return top5

#print(find_top5(G, '<https://coursera.graph.edu/user_619.0>', '<https://coursera.graph.edu/course_2758>' ))
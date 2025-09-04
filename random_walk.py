import networkx as nx
import random
from rdflib import Graph

def is_valid_node(G, n):
    """
    Permet de définir les noeuds valides lors de la création du random walk. 
    Evite les cours qui ont un degré sortant null et les cours n'ayant aucun knowledge topic.
    Entrée : 
    - G : un DiGraph
    - n : un noeud
    Sortie : True si le noeud est valide, false sinon."""
    return G.out_degree(n) > 0 and n not in bad_cours

def random_walk(G, start_node):
    """
    Génère une recommandation de cours aléatoire. Le cours recommandé n'a pas déjà été suivi par l'utilisateur
    et doit être considéré comme valide, c'est à dire qu'il a au moins un topic.
    Entrée : 
    - G : un DiGraph
    - start_node : le noeud à partir duquel on va partir.
    Sortie : 
    walk : La liste des noeuds formant le chemin trouvé, ordonnés.
    """
    walk = [start_node]
    current_node = start_node

    query = f"""
    SELECT DISTINCT ?course WHERE {{
        ?course a <https://schema.org/LearningResource> .
        
        FILTER NOT EXISTS {{
            <{start_node}> ?interest ?course .
            FILTER(?interest IN (<https://coursera.graph.edu/HighInterest>,
                                 <https://coursera.graph.edu/MediumInterest>,
                                 <https://coursera.graph.edu/SmallInterest>))
        }}
    }}
    """
    qres = g.query(query)
    cours_not_followed = [str(row.course) for row in qres]

    while current_node not in cours_not_followed: # Continuer tant que le chemin est trop court et le noeud n'est pas un cours.
        neighbors = list(G.neighbors(current_node))
        good_n = [n for n in neighbors if is_valid_node(G, n) and n not in walk] # Cherche parmi les voisins valides qui n'ont pas déjà été visités.

        if not good_n:
            if len(walk) > 1:
                popped = walk.pop()
                current_node = walk[-1]
                print(f"Recul à {current_node}, enlève {popped}")
                continue
            else:
                print("Fin de la marche, plus d’options.")
                break

        current_node = random.choice(good_n)
        walk.append(current_node)

    return walk


# On importe le graphe et le convertit en DiGraph
g = Graph()
input_file = "combined_graph.ttl"
g.parse(input_file, format="ttl")

G = nx.DiGraph()
for s,p,o in g:
    G.add_edge(str(s), str(o), predicate =str(p))

knows_query = """
SELECT DISTINCT ?sub ?p ?o
WHERE {
    ?sub a <https://schema.org/Person>.
}"""

# Requête SPARQL pour trouver les mauvais cours, ceux qui n'ont pas de knowledge topic

badlessons_query = """
SELECT distinct ?s WHERE {
  ?s a <https://schema.org/LearningResource>.
  FILTER NOT EXISTS { ?s <https://coursera.graph.edu/hasKnowledgeTopic> ?o}
}"""

lres = g.query(badlessons_query)
bad_cours=[]
for row in lres:
    bad_cours.append(str(row.s))




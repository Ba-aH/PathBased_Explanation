import rdflib
import networkx as nx
import json

def load_ttl_to_nx(file_path):
  rdf_graph = rdflib.Graph()
  rdf_graph.parse(file_path, format='ttl')

  G = nx.DiGraph()  # ou nx.Graph() si non orienté

  for subj, pred, obj in rdf_graph:
      G.add_edge(str(subj), str(obj), label=str(pred))

  return G


def generer_graphe_pondere_max():

  # Attribution weight aux prédicats
  d= {"https://coursera.graph.edu/SmallInterest":50,
      "https://coursera.graph.edu/MediumInterest":25,
      "https://coursera.graph.edu/HighInterest":0}

  # Charger le fichier .ttl
  g = rdflib.Graph()
  g.parse("./combined_graph.ttl", format="ttl")

  # Créer un graphe dirigé (ou non dirigé selon le besoin)
  G = nx.DiGraph()  # ou nx.Graph() si non orienté

  # Ajouter les arêtes au graphe à partir des triplets RDF
  for s, p, o in g:
    if str(p) in  d :
      G.add_edge(str(s), str(o), weight = d[str(p)], label=str(p))
    else:
      G.add_edge(str(s), str(o), weight = 1, label=str(p))
  return G

# Trouver le plus court chemin entre deux sommets
source = "https://coursera.graph.edu/user_191.0"
target = "https://coursera.graph.edu/course_1992"

def find_path(G, start, end):
    try:
        start = "https://coursera.graph.edu/"+start
        end = "https://coursera.graph.edu/" + end
        path = nx.shortest_path(G, weight='weight',source=start, target=end,method = "bellman-ford")
        return path
    except nx.NetworkXNoPath:
        return None
    
def find_path_shortest(G, start, end):
    try:
        start = "https://coursera.graph.edu/"+start
        end = "https://coursera.graph.edu/" + end
        path = nx.shortest_path(G,source=start, target=end,method = "bellman-ford")
        return path
    except nx.NetworkXNoPath:
        return None
    
def find_all_path_shortest(G, start, end):
    try:
        start = "https://coursera.graph.edu/"+start
        end = "https://coursera.graph.edu/" + end
        path = nx.all_shortest_paths(G,weight="weight",source=start, target=end)
        return path
    except nx.NetworkXNoPath:
        return None    

#####################    

def find_path_modif(G, start, end):
  try:
      path = nx.shortest_path(G, weight = 'weight',source=start, target=end)
      pathGraph = nx.path_graph(path)
      l_path_edges = []
      l_path_nodes = []
      for ea in pathGraph.edges():
        l_path_edges.append(G.edges[ea[0],ea[1]]['label'])
        l_path_nodes.append(ea[0])
        f=ea[1]
      l_path_nodes.append(f)
      d_res = {'nodes':l_path_nodes, 'edges' : l_path_edges}
       
      return d_res
  except nx.NetworkXNoPath:
      return None

def path_edges_with_labels(G, path):
    edges = []
    for i in range(len(path) - 1):
        u, v = path[i], path[i + 1]
        label = G[u][v].get("label", "")
        edges.append({"from": u, "to": v, "label": label})
    return edges

def voisins_de(G,node_id):
  liste_voisins= list(G.successors[node_id])
  nodes = [{"id": n, "label": n} for n in liste_voisins]
  edges = [
        {"from": node_id, "to": v, "label": G[node_id][v].get("label", "")}
        for v in liste_voisins
    ]
  return 0
def graph_to_json(G, out_file):
    nodes = [{"id": n, "label": n} for n in G.nodes()]
    edges = [
        {"from": u, "to": v, "label": G[u][v].get("label", "")}
        for u, v in G.edges()
    ]

    with open(out_file, "w") as f:
        json.dump({"nodes": nodes, "edges": edges}, f, indent=2)

def path_to_json(G, path, out_file):
    nodes = []
    for n in path : 
      if "https://coursera.graph.edu/user" in n:
        nodes.append({"id": n, "label": n.split('/')[-1], "group":0})
      elif "https://coursera.graph.edu/course" in n:
        nodes.append({"id": n, "label": n.split('/')[-1], "group":1})
      else:
        nodes.append({"id": n, "label": n.split('/')[-1], "group":2})

    edges = []
    for i in range(len(path) - 1):
        u, v = path[i], path[i + 1]
        label = G[u][v].get("label", "").split('/')[-1] if G.has_edge(u, v) else ""
        edges.append({"from": u, "to": v, "label": label})

    with open(out_file, "w") as f:
        json.dump({"nodes": nodes, "edges": edges}, f, indent=2)







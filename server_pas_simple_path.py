from flask import Flask, request, jsonify
from flask_cors import CORS
import networkx as nx
from paths import  find_path_shortest, find_path,find_all_path_shortest
from random_walk import random_walk
from Top5 import find_top5
import rdflib

def generer_graphe_pondere():

  # Attribution weight aux prédicats
  d= {"https://coursera.graph.edu/SmallInterest":4,
      "https://coursera.graph.edu/MediumInterest":2,
      "https://coursera.graph.edu/HighInterest":0}

  # Charger le fichier .ttl
  global g
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


def generer_graphe_pondere_choix(listePredicats):

  
  # Charger le fichier .ttl
  #g = rdflib.Graph()
  #g.parse("./combined_graph.ttl", format="ttl")

  # Créer un graphe dirigé (ou non dirigé selon le besoin)
  G = nx.DiGraph()  # ou nx.Graph() si non orienté

  poidsMax = 25*len(listePredicatsTotal)
  # Ajouter les arêtes au graphe à partir des triplets RDF
  for s, p, o in g:
    if str(p).split("/")[-1] in listePredicats : 
        G.add_edge(str(s), str(o), weight = 0, label=str(p))
        
    else:
        G.add_edge(str(s), str(o), weight = poidsMax, label=str(p))
  print("G_choix generé")
  return G

def compute_path_data(graph, user, course,w=True):
    """Retourne nodes + edges pour un chemin entre deux sommets"""
    if w==True:

        path = find_path(graph, user, course)
    else:
        path = find_path_shortest(graph,user,course)
    if not path:
        return None

    nodes = []
    for n in path:
        t = ""
        for _, v, edge_data in graph.out_edges(n, data=True):  # arêtes sortantes de n
            if "title" in edge_data.get("label", ""):
                t = v 
                break
        if t=="":
            nodes.append({
                "id": n,
                "label": n.split('/')[-1],
                "group": (
                    3 if user ==n.split('/')[-1] or course ==n.split('/')[-1] else 0 if "user" in n else 1 if "course" in n  else 2 if "topics" in n else 4
                ),
            })
        else:
            nodes.append({
                "id": n,
                "label": n.split('/')[-1],
                "group": (
                    3 if user ==n.split('/')[-1] or course ==n.split('/')[-1] else 0 if "user" in n else 1 if "course" in n  else 2 if "topics" in n else 4
                ),
                "title":"Title : "+t,
            })

    edges = []
    for i in range(len(path) - 1):
        u, v = path[i], path[i + 1]
        label = graph[u][v].get("label", "").split('/')[-1]
        weight = graph[u][v].get("weight", 1.0)  # default weight is 1.0 if not specified
        edges.append({"from": u, "to": v, "label": label, 'length':500, "weight" : weight})

    return {"nodes": nodes, "edges": edges}


def compute_all_paths_data(G, user, course,w=True):
    """Retourne nodes + edges pour un chemin entre deux sommets"""


    l_path = find_all_path_shortest(G, user, course)
    

    global path_general

   
    if not l_path:
        return None

    liste_patterns = []
    nbr_pattern = 0
    liste_res=[]
    nbr_paths =0
    for path in l_path:
        pattern = []
        if nbr_pattern > 10 or nbr_paths >100:
            print("break")
            print(len(liste_res))
            return liste_res
        nbr_paths += 1

        edges = []
        for i in range(len(path) - 1):
            u, v = path[i], path[i + 1]
            label = G[u][v].get("label", "").split('/')[-1]
            pattern.append(label)
            edges.append({"from": u, "to": v, "label": label, 'length':500})

        if pattern in liste_patterns :
            continue
        

        nodes = []
        for n in path:
            t = ""
            for _, v, edge_data in G.out_edges(n, data=True):  # arêtes sortantes de n
                if "title" in edge_data.get("label", ""):
                    t = v 
                    break
            if t=="":
                nodes.append({
                    "id": n,
                    "label": n.split('/')[-1],
                    "group": (
                        3 if user ==n.split('/')[-1] or course ==n.split('/')[-1] else 0 if "user" in n else 1 if "course" in n  else 2 if "topics" in n else 4
                    ),
                })
            else:
                nodes.append({
                    "id": n,
                    "label": n.split('/')[-1],
                    "group": (
                        3 if user ==n.split('/')[-1] or course ==n.split('/')[-1] else 0 if "user" in n else 1 if "course" in n  else 2 if "topics" in n else 4
                    ),
                    "title":"Title : "+t,
                })
            

        
        if path_general['nodes'] != nodes:
            liste_patterns.append(pattern)
            nbr_pattern += 1
            liste_res.append({"nodes": nodes, "edges": edges})
        print("nodes :",nodes)
    print(len(liste_res))
    return liste_res



def test_compute_all_paths_data_len(G, user, course,max=6):
    try:
        user = "https://coursera.graph.edu/"+user
        course = "https://coursera.graph.edu/" + course
        paths = nx.all_simple_paths(G, source=user, target=course, cutoff=max-1)
        return paths
    except nx.NetworkXNoPath:
        return None


def predicats(G):
    liste = []
    for u,v,e in G.edges(data=True):
        l=e.get("label","")
        if l not in liste:
            liste.append(l)
    return liste


















app = Flask(__name__)


G = generer_graphe_pondere()

CORS(app)  # autoriser les requêtes depuis index.html
CORS(app, resources={r"/api/*": {"origins": "http://localhost:8000"}})
@app.route("/api/pathETvoisins")
def api_pathETvoisins():
    
    user = request.args.get("start")
    course = request.args.get("end")
    node_id = request.args.get("voisin")
    choix = request.args.get("choix")
    if not user or not course or not node_id:
        return jsonify({"error": "Missing parameters"}), 400

    if node_id not in G:
        return jsonify({"error": f"No such node: {node_id}"}), 404
    if choix== "true":
        graph = G_choix
        print("choix = true")
    else:
        graph = G

    json_chemin = compute_path_data(graph, user, course)

    liste_voisins= list(graph.successors(node_id))
    for n in liste_voisins:
        if not any(node["id"] == n for node in json_chemin["nodes"]):
            t = ""
            for _, v, edge_data in graph.out_edges(n, data=True):  # arêtes sortantes de n
                if "title" in edge_data.get("label", ""):
                    t = v 
                    break
            if t=="":
                json_chemin["nodes"].append({
                    "id": n,
                    "label": n.split('/')[-1],
                    "group": (
                        3 if user ==n.split('/')[-1] or course ==n.split('/')[-1] else 0 if "user" in n else 1 if "course" in n  else 2 if "topics" in n else 4
                    ),
                })
            else:
                json_chemin["nodes"].append({
                    "id": n,
                    "label": n.split('/')[-1],
                    "group": (
                        3 if user ==n.split('/')[-1] or course ==n.split('/')[-1] else 0 if "user" in n else 1 if "course" in n  else 2 if "topics" in n else 4
                    ),
                    "title":"Title : "+t,
                })
            label = graph[node_id][n].get("label", "").split('/')[-1]
            json_chemin["edges"].append({"from": node_id, "to": n, "label": label})


    return jsonify(json_chemin)

CORS(app, resources={r"/api/*": {"origins": "http://localhost:8000"}})
@app.route("/api/voisins")
def api_voisins():
    node_id = request.args.get("voisin")
    choix = request.args.get("choix")
    if not node_id:
        return jsonify({"error": "Missing parameters"}), 400

    if choix== "true":
        print("choix = true")
        graph = G_choix
    else:
        graph = G


    if node_id not in graph:
        return jsonify({"error": f"No such node: {node_id}"}), 404

    liste_voisins= list(graph.successors(node_id))
    json_chemin = {"nodes":[],"edges":[]}
    for v in liste_voisins:
        t = ""
        for _, u, edge_data in graph.out_edges(v, data=True):  # arêtes sortantes de n
            if "title" in edge_data.get("label", ""):
                t = u 
                break
        if t=="":
            json_chemin["nodes"].append({
                "id": v,
                "label": v.split('/')[-1],
                "group": (
                    0 if "user" in v else 1 if "course" in v  else 2 if "topics" in v else 4
                ),
            })
        else:
            json_chemin["nodes"].append({
                "id": v,
                "label": v.split('/')[-1],
                "group": (
                    0 if "user" in v else 1 if "course" in v else 2 if "topics" in v else 4
                ),
                "title":"Title : "+t,
            })
        
        label = graph[node_id][v].get("label", "").split('/')[-1]
        json_chemin["edges"].append({"from": node_id, "to": v, "label": label})


    return jsonify(json_chemin)

CORS(app, resources={r"/api/*": {"origins": "http://localhost:8000"}})
@app.route("/api/path")
def api_path():
    user = request.args.get("start")
    course = request.args.get("end")
    w = request.args.get("w")
    choix = request.args.get("choix")

    if not user or not course:
        return jsonify({"error": "start and end required"}), 400

    if choix == "true":
        print("choix = true")
        data = compute_path_data(G_choix, user, course)
        
    else : 
        if w=="true":
            data = compute_path_data(G, user, course)
        else:
            data = compute_path_data(G, user, course, False)

    global path_general
    path_general = data
    print("path general : ",path_general)
    if not data:
        return jsonify({"error": "no path found"}), 404


    return jsonify(data)

CORS(app, resources={r"/api/*": {"origins": "http://localhost:8000"}})
@app.route("/api/all_path")
def api_all_path():
    user = request.args.get("start")
    course = request.args.get("end")
    choix = request.args.get("choix")
    print("choix : ", choix)

    if not user or not course:
        return jsonify({"error": "start and end required"}), 400

    print("path general dans all path : ",path_general)
    if choix == "true":
        print("choix = true")
        data = compute_all_paths_data(G_choix, user, course)
    else : 
        data = compute_all_paths_data(G, user, course)
    
    
    if not data:
        return jsonify({"error": "no path found"}), 404


    return jsonify(data)


CORS(app, resources={r"/api/*": {"origins": "http://localhost:8000"}})
@app.route("/api/predicats")
def api_predicats():

    global listePredicatsTotal 
    listePredicatsTotal = predicats(G)
    
    if not listePredicatsTotal:
        return jsonify({"error": "no predicat found"}), 404


    return jsonify(listePredicatsTotal)


CORS(app, resources={r"/api/*": {"origins": "http://localhost:8000"}})
@app.route('/api/predicats_ordonnés', methods=['POST'])
def receive_ordered_predicates():
    data = request.get_json()
    ordered_predicates = data.get('predicates', [])
    print("Liste reçue :", ordered_predicates)
    global G_choix
    G_choix = generer_graphe_pondere_choix(ordered_predicates)
    # TODO : traitement, enregistrement, etc.

    return jsonify({"message": "Prédicats bien reçus", "nb": len(ordered_predicates)})


CORS(app, resources={r"/api/*": {"origins": "http://localhost:8000"}})
@app.route("/api/random_course")
def api_random_course():
    user = request.args.get("start")

    if not user:
        return jsonify({"error": "user param required"}), 400
    
    user_uri = f"https://coursera.graph.edu/{user}"
    walk = random_walk(G, user_uri)

    if not walk:
        return jsonify({"error": "no random walk found"}), 404
    
    course = walk[-1]

    course_id = course.split('/')[-1]
    return jsonify({"course": course_id})

CORS(app, resources={r"/api/*": {"origins": "http://localhost:8000"}})
@app.route("/api/top5")
def api_find_top5():
    user = request.args.get("user")
    course = request.args.get("course")

    if not user:
        return jsonify({"error": "user param required"}), 400
    
    if not course:
     return jsonify({"error": "course param required"}), 400
    
    user_uri = f"<https://coursera.graph.edu/{user}>"
    course_uri = f"<https://coursera.graph.edu/{course}>"
    
    top5 = find_top5(G, user_uri, course_uri)

    if not top5:
        return jsonify({"error": "no top 5 found"}), 404
    
    return jsonify(top5)


if __name__ == "__main__":
    app.run(debug=True)

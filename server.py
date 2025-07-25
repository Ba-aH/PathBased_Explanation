from flask import Flask, request, jsonify
from flask_cors import CORS
import networkx as nx
from paths import find_path_shortest, find_path,find_all_path_shortest
from random_walk import random_walk
from Top5 import find_top5
import rdflib
import sys,csv,os
from urllib.parse import quote

""" liste_question_possible = {'answer0':'This explanation lets me judge when I should trust the recommendation system.','answer1':
                'This explanation of how the recommendation system works has sufficient detail.','answer2':
                'This explanation of how the recommendation system works has irrelevant detail.','answer3':
            'Based on the share of semantic attributes between the recommended movie and your interest in these semantic attributes : This is a good recommendation',
                   'answer4': 'Based on the share of semantic attributes between the recommended movie and your interest in these semantic attributes : I will follow this course',
                   'answer5': 'Based on the share of semantic attributes between the recommended movie and your interest in these semantic attributes : I can determine how well I will like this course'
        } """

def generer_texte(path):
    dico_txt={'SmallInterest':" has a small interest in ",
    'MediumInterest':" has a medium interest in ",
    'HighInterest':" has a high interest in ",
    'hasKnowledgeTopic':", that has the knowledge topic ",
    'cso#relatedEquivalent':', that has the related equivalent ',
    'cso#preferentialEquivalent':', that has the preferential equivalent ',
    'cso#contributesTo':', that contributes to the topic ',
    'cso#superTopicOf' : ', that is a super topic of ',
    'isKnowledgeTopicOf':', that is a knowledge topic of the course '}
    texte = ''
    n_from = "user_"
    for i in range(len(path['edges'])):
        for edge in path['edges']:
            if n_from in edge['from']:
                if 'user_' in edge['from']:
                    texte += edge['from'].split('/')[-1]+" "
                texte += dico_txt[edge['label']]
                texte+= edge['to'].split('/')[-1]+" "
                n_from = edge['to']
                break
    return texte


def generer_graphe_pondere():

  # Attribution weight aux prédicats
  d= {"https://coursera.graph.edu/SmallInterest":4,
      "https://coursera.graph.edu/MediumInterest":2,
      "https://coursera.graph.edu/HighInterest":0.1}

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

  # Créer un graphe dirigé (ou non dirigé selon le besoin)
  G = nx.DiGraph()  # ou nx.Graph() si non orienté


  # Ajouter les arêtes au graphe à partir des triplets RDF
  for s, p, o in g:
    if str(p).split("/")[-1] in listePredicats : 
        G.add_edge(str(s), str(o), weight = 0.1, label=str(p))
        
    else:
        G.add_edge(str(s), str(o), weight = 25*len(data), label=str(p))
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


    #l_path = find_all_path_shortest(G, user, course)
    l_path = test_compute_all_paths_data_len(G, user, course)
    l_path = list(l_path)
    l_path.sort(key=lambda path: sum(G[path[i]][path[i+1]]["weight"] for i in range(len(path)-1)))
    

    global path_general

   
    if not l_path:
        return None

    liste_patterns = []
    nbr_pattern = 0
    liste_res=[]
    nbr_paths =0
    for path in l_path:
        pattern = []
        if nbr_pattern > 10 or nbr_paths >50:
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

def compute_all_paths_data_index(G, user, course,a,b,w=True):
    """Retourne nodes + edges pour un chemin entre deux sommets"""


    # Récuperer les premiers chemins les plus légers (différents patterns)
    l_path = test_compute_all_paths_data_len(G, user, course)
    l_path = list(l_path)
    l_path.sort(key=lambda path: sum(G[path[i]][path[i+1]]["weight"] for i in range(len(path)-1)))
    

    global path_general

   
    if not l_path:
        return None

    liste_patterns = []
    nbr_pattern = 0
    liste_res=[]
    nbr_paths =0
    for path in l_path:
        pattern = []
        if nbr_pattern > 20 or nbr_paths >300:
            print("break")
            print(len(liste_res))
            break
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
                        3 if user ==n.split('/')[-1] or course ==n.split('/')[-1] else 0 if "user" in n else 1 if "course" in n.split('/')[-1]  else 2 if "topics" in n else 4
                    ),
                })
            else:
                nodes.append({
                    "id": n,
                    "label": n.split('/')[-1],
                    "group": (
                        3 if user ==n.split('/')[-1] or course ==n.split('/')[-1] else 0 if "user" in n else 1 if "course" in n.split('/')[-1]  else 2 if "topics" in n else 4
                    ),
                    "title":"Title : "+t,
                })
            
        # transformer path en texte : node/edge/node/edge...
        texte = ''
        n_from = "user_"
        for i in range(len(edges)):
            for edge in edges:
                if n_from in edge['from']:
                    if 'user_' in edge['from']:
                        texte += edge['from'].split('/')[-1]+"/"
                    texte += edge['label']+ "/"
                    texte+= edge['to'].split('/')[-1]+"/"
                    n_from = edge['to']
                    break
        
        
        
        liste_patterns.append(pattern)
        nbr_pattern += 1
        liste_res.append({"nodes": nodes, "edges": edges,"longueur":len(nodes)-1,'pattern':pattern, 'path':texte}) ###################################################Ajout longueur chemin
        print("nodes :",nodes)
    

    # Appliquer à ces chemins sélectionnés les indexs Jaccard et Random Walk based
    ## Random walk based :
    liste_S_rw = []
    min_S_rw = sys.maxsize
    max_S_rw = 0
    poidsMax = 25*len(data)
    for p in liste_res:
        S_rw = 1
        l_nodes = p['nodes']
        for i_node in range(1,len(l_nodes)):
            S_rw *= 0.5*poidsMax/(G.out_degree(l_nodes[i_node - 1]['id'])*G[l_nodes[i_node - 1]['id']][l_nodes[i_node]['id']]["weight"])
            #if G[l_nodes[i_node - 1]['id']][l_nodes[i_node]['id']]["weight"] == poidsMax:
            #    S_rw *= 0.1/G.out_degree(l_nodes[i_node - 1]['id'])
            #else:
            #    S_rw *= poidsMax/G.out_degree(l_nodes[i_node - 1]['id'])##??????????????????????????????????!!!!! Reflechir à la valeur de weight !!!!
        # puissance 1/L
        S_rw = S_rw**(1/(len(l_nodes)-1))
        if S_rw < min_S_rw:
            min_S_rw = S_rw
        if S_rw > max_S_rw:
            max_S_rw = S_rw

        p['S_rw']=S_rw
        liste_S_rw.append(S_rw)
    
    # Normalisation
    for i in range(len(liste_S_rw)):
        S_RW = (liste_S_rw[i]-min_S_rw)/(max_S_rw - min_S_rw)
        liste_S_rw [i] = S_RW
        liste_res[i]['S_rw'] = S_RW
        liste_res[i]['S_final'] = a*S_RW

    
    print(liste_S_rw)
    print(len(liste_res))
    print(liste_res)

    # Sort en fonction de l'index :
    # Associe les indices aux valeurs
    #indices_tries = sorted(range(len(liste_S_rw)), key=lambda i: liste_S_rw[i], reverse=True)

    # Trie liste_res selon ces indices
    #liste_res_triee = [liste_res[i] for i in indices_tries]

    

    # Jaccard :
    liste_S_jac = []
    min_S_jac = sys.maxsize
    max_S_jac = 0
    for i in range(len(liste_res)):
        S_jac = 0
        for j in range(len(liste_res)):
            if i != j :
                S_jac += (len(list((set(node['id'] for node in liste_res[i]['nodes']) & set(node['id'] for node in liste_res[j]['nodes'])
                | (set("from"+ edge['from'] + "to" + edge['to'] + "label"+edge['label'] for edge in liste_res[i]['edges']) &
                    set("from"+ edge['from'] + "to" + edge['to'] + "label"+edge['label'] for edge in liste_res[j]['edges']))))))/ (len(list(set(node['id'] for node in liste_res[i]['nodes']) |
                                                                                                set(node['id'] for node in liste_res[j]['nodes']) |
                                                                                                set("from"+ edge['from'] + "to" + edge['to'] + "label"+edge['label'] for edge in liste_res[i]['edges']) |
                                                                                                set("from"+ edge['from'] + "to" + edge['to'] + "label"+edge['label'] for edge in liste_res[j]['edges']))))
        S_jac /= (len(liste_res)-1)
        print(S_jac)

        if S_jac < min_S_jac:
            min_S_jac = S_jac
        if S_jac > max_S_jac:
            max_S_jac = S_jac

        p['S_jac']=S_jac
        liste_S_jac.append(S_jac)

    print('liste s_jac : ',liste_S_jac)
    ## Normalisation
    for i in range(len(liste_S_jac)):
        if max_S_jac != min_S_jac:
            S_JAC = (liste_S_jac[i]-min_S_jac)/(max_S_jac - min_S_jac)
        else:
            S_JAC = 0
        liste_S_jac[i] = S_JAC
        liste_res[i]['S_jac'] = S_JAC
        liste_res[i]['S_final'] += b*S_JAC

   
    # Trier liste_res en fct de S_final
    ##liste_res.sort(key=lambda path: path['S_final'] , reverse = True)

    # Trier liste_res en fct de la longueur
    liste_res.sort(key=lambda path: path['longueur'])

    return {'path' : liste_res[0],'all_paths':liste_res} #Soit [0] pour garder le chemin principal en bas, soit .pop(0)




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

@app.route('/api/pathETvoisins', methods=['POST'])
def receive_predicates_pathETvoisins():
    data = request.get_json()
    predicates = data.get('predicates', [])
    print("Liste reçue :", predicates)

    user = request.args.get("start")
    course = request.args.get("end")
    node_id = request.args.get("voisin")
    choix = request.args.get("choix")
    if not user or not course or not node_id:
        return jsonify({"error": "Missing parameters"}), 400

    print("node_id avant :",node_id)
    

    if node_id not in G:
        node_id = quote(node_id, safe=":/")
        print("node_id après :",node_id)
        if node_id not in G:
            return jsonify({"error": f"No such node: {node_id}"}), 404
    if choix== "true":
        graph = G_choix
        print("choix = true")
    else:
        graph = G

    



    #json_chemin = compute_path_data(graph, user, course)
    json_chemin = {"nodes":[],"edges":[]}
    liste_voisins= list(graph.successors(node_id))
    print("liste voisins : ",liste_voisins)
    
    for n in liste_voisins:
        label = graph[node_id][n].get("label", "").split('/')[-1]
        print("label : ",label, label in predicates)
        if len(predicates)==0:
            ignorer = True
        else:
            ignorer = False
        if 'url' in label:
            nom_label = n
        else:
            nom_label = n.split('/')[-1]
        #if (label in predicates or ignorer) and not any(node["id"] == n for node in json_chemin["nodes"]) :
        if (label in predicates or ignorer):
            t = ""
            for _, v, edge_data in graph.out_edges(n, data=True):  # arêtes sortantes de n
                if "title" in edge_data.get("label", ""):
                    t = v 
                    break
            if t=="":
                json_chemin["nodes"].append({
                    "id": n,
                    "label": nom_label,
                    "group": (
                        3 if user ==n.split('/')[-1] or course ==n.split('/')[-1] else 1 if "course" in n.split('/')[-1]   else 2 if "topics" in n else 0 if "user" in n else 4
                    ),
                })
            else:
                json_chemin["nodes"].append({
                    "id": n,
                    "label": nom_label,
                    "group": (
                        3 if user ==n.split('/')[-1] or course ==n.split('/')[-1] else 1 if "course" in n.split('/')[-1]   else 2 if "topics" in n else 0 if "user" in n else 4
                    ),
                    "title":"Title : "+t,
                })
            print(label)
            print()
            json_chemin["edges"].append({"from": node_id, "to": n, "label": label}) # modif !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! 11/07/2025


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

    print("node_id avant :",node_id)
   
    if node_id not in G:
        node_id = quote(node_id, safe=":/")
        print("node_id après :",node_id)
        if node_id not in G:
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
    a = 0.5
    b = 1 - a

    if not user or not course:
        return jsonify({"error": "start and end required"}), 400


    if choix == "true":
        print("choix = true")
        data = compute_all_paths_data_index(G_choix, user, course,a,b)
        
    else : 
        data = compute_all_paths_data_index(G, user, course,a,b)


    global all_paths_res
    all_paths_res = data
    #print("path general : ",path_general)
    if not data:
        return jsonify({"error": "no path found"}), 404
    if not data['path']:
        return jsonify({"error": "no path found"}), 404

    txt = generer_texte(data['path'])
    return jsonify({'path':data['path'],'texte':txt})

CORS(app, resources={r"/api/*": {"origins": "http://localhost:8000"}})
@app.route("/api/all_path")
def api_all_path():
    a = 0.5
    b = 1 - a
    user = request.args.get("start")
    course = request.args.get("end")
    choix = request.args.get("choix")
    print("choix : ", choix)

    if not user or not course:
        return jsonify({"error": "start and end required"}), 400

    
    if not all_paths_res:
        return jsonify({"error": "no path found"}), 404


    return jsonify(all_paths_res['all_paths'])


CORS(app, resources={r"/api/*": {"origins": "http://localhost:8000"}})
@app.route("/api/predicats")
def api_predicats():

    global data 
    data = predicats(G)
    
    if not data:
        return jsonify({"error": "no predicat found"}), 404


    return jsonify(data)


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
    if top5 is None:
        return jsonify({"error": "no top 5 found"}), 404

    return jsonify(top5)



# CORS(app, resources={r"/api/*": {"origins": "http://localhost:8000"}})
# @app.route('/api/user_study', methods=['POST'])
# def receive_user_study():
#     data = request.get_json()
#     user_study = data.get('user_study', [])
#     user_id = data.get('user_id', [])
#     print("User study reçue :", user_study,", user id :", user_id)
#     import csv

   
#     # Nom du fichier
#     filename = "reponses_user_study.csv"

#     # Création du fichier CSV
#     with open(filename, mode='w', newline='', encoding='utf-8') as file:
#         writer = csv.writer(file)

#         # Écriture de l'entête
#         headers = ['pattern']+ [liste_question_possible['answer'+str(i)] for i in range(6)]+['longueur']+['S_jac']+['S_rw']+['S_tot']+['path']
#         writer.writerow(headers)

#         # Écriture des lignes
#         for question, answers in user_study.items():
#             row = [question] + [answers.get(f'answer{i}', '') for i in range(6)]+ [answers.get('longueur','')]+ [answers.get('S_jac','')]+ [answers.get('S_rw','')]+ [answers.get('S_tot','')]+ [answers.get('path','')]
#             writer.writerow(row)

#     print(f"Fichier CSV '{filename}' créé avec succès.")


#     return jsonify({"message": "User study bien reçue"})



### Version CSV
""" CORS(app, resources={r"/api/*": {"origins": "http://localhost:8000"}})

@app.route('/api/user_study', methods=['POST'])
def receive_user_study():
    data = request.get_json()
    user_study = data.get('user_study', {})
    user_id = data.get('user_id', '')

    print("User study reçue :", user_study, ", user id :", user_id)

    filename = "reponses_user_study.csv"

    # En-têtes
    headers = ['user_id', 'pattern'] + [f'answer{i}' for i in range(6)] + ['longueur', 'S_jac', 'S_rw', 'S_tot', 'path']

    # Charger les anciennes données si le fichier existe
    existing_rows = []
    if os.path.exists(filename):
        with open(filename, mode='r', newline='', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            for row in reader:
                # Ne garder que les lignes des autres utilisateurs
                if row['user_id'] != user_id:
                    existing_rows.append(row)

    # Ajouter les nouvelles réponses de l'utilisateur courant
    for pattern, answers in user_study.items():
        row = {
            'user_id': user_id,
            'pattern': pattern,
            **{f'answer{i}': answers.get(f'answer{i}', '') for i in range(6)},
            'longueur': answers.get('longueur', ''),
            'S_jac': answers.get('S_jac', ''),
            'S_rw': answers.get('S_rw', ''),
            'S_tot': answers.get('S_tot', ''),
            'path': answers.get('path', '')
        }
        existing_rows.append(row)

    # Réécriture du fichier CSV
    with open(filename, mode='w', newline='', encoding='utf-8') as file:
        writer = csv.DictWriter(file, fieldnames=headers)
        writer.writeheader()
        writer.writerows(existing_rows)

    print(f"Fichier CSV '{filename}' mis à jour avec les réponses de l'utilisateur {user_id}.")

    return jsonify({"message": "User study bien reçue et enregistrée"}) """

CORS(app, resources={r"/api/*": {"origins": "http://localhost:8000"}})

@app.route('/api/user_study', methods=['POST'])
def receive_user_study():
    import json
    data = request.get_json()
    user_study = data.get('user_study', {})
    user_id = data.get('user_id', '')

    print("User study reçue :", user_study, ", user id :", user_id)

    formatted_feedback = {
        "user": user_id,
        "general_feedback": user_study.get("general_feedback", {}),
        "path_feedback": []
    }


    path_feedback_dict = user_study.get("path_feedback", {})
    questions_specifiques = user_study.get("questions_specifiques", [])

    print("\npath_feedback_dict : ",path_feedback_dict)
    print("\nquestions_specifiques : ",questions_specifiques)


    for pattern, pdata in path_feedback_dict.items():
        print("\nContenu de pdata :", json.dumps(pdata, indent=2))
        entry = {
            "pattern": pattern,
            "path": pdata.pop("path", ""),
            "length": pdata.pop("longueur", None),
            "S_jac": pdata.pop("S_jac", None),
            "S_rw": pdata.pop("S_rw", None),
            "S_tot": pdata.pop("S_tot", None),
            "answers": {k: v for k, v in pdata.items() if k.startswith("answer")},
            #"answers": {
            #    questions_specifiques[int(k.replace("answer", ""))]: v
             #   for k, v in pdata.items()
              #  if k.startswith("answer") and k.replace("answer", "").isdigit() and int(k.replace("answer", "")) < len(questions_specifiques)
           # }
        }
        formatted_feedback["path_feedback"].append(entry)


    # 💾 Sauvegarde en fichier JSON
    with open(f"{user_id}_feedback.json", "w", encoding="utf-8") as f:
        json.dump(formatted_feedback, f, indent=2, ensure_ascii=False)

    print(f"Feedback saved to {user_id}_feedback.json")

    return jsonify({"message": "User study bien reçue et enregistrée"})

if __name__ == "__main__":
    app.run(debug=True)


if __name__ == "__main__":
    app.run(debug=True)



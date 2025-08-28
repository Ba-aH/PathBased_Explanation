from flask import Flask, request, jsonify
from flask_cors import CORS
import networkx as nx
from paths import find_path_shortest, find_path,find_all_path_shortest
from random_walk import random_walk
from Top5 import find_top5
import rdflib
import sys,csv,os
from urllib.parse import quote
import itertools


def generer_texte(path):
    """Permet de générer l'explication textuelle.
    Entrée : 
    - path : dico représentant le chemin avec ses noeuds et ses arêtes.
    Sortie : 
    - texte : str, l'explication sous forme textuelle.
    """
    #Dictionnaire permettant de convertir les arêtes en texte
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
    # Début du texte
    n_from = "user_"

    #On génère le texte à partir des arêtes du chemin
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
  """
  Permet de générer un graphe on pondérant les arêtes xxxInterest en fonction de leur importance afin de favoriser les intérets plus élevés
  Sortie : 
  - G : DiGraph"""

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

def compute_all_paths_data_index(G, user, course,a,b,w=True):
    """
    Retourne nodes + edges pour les chemins entre deux sommets après les avoir traités et calculé leur scores random walk et Jaccard.
    Entrée : 
    - G : DiGraph
    - user : str, l'utilisateur
    - course : str, le cours recommandé
    - a, b : float, la pondération des indices random walk et Jaccard pour calculer le score total.
    - w : bool
    Sortie : 
    - dictionnaire indiquant le chemin principal ainsi que l'ensemble des chemins conservés, y compris le chemin principal
    """


    # On récupère tous les chemins simples et on les convertit en une liste que l'on trie par poids.
    """ l_path = compute_all_paths_data_len(G, user, course)
    l_path = list(l_path) """
    
    l_path = bounded_simple_paths(G, user, course, cutoff=5)
    l_path = list(l_path)

    l_path.sort(key=lambda path: sum(G[path[i]][path[i+1]]["weight"] for i in range(len(path)-1)))
    

    global path_general

   
    if not l_path:
        return None

    # Initialisation des variables
    liste_patterns = []
    nbr_pattern = 0
    liste_res=[]
    nbr_paths =0

    # On traite chaque chemin de la liste
    for path in l_path:
        pattern = []
        # On sort de la boucle si trop de patterns ou de chemins trouvés.
        if nbr_pattern > 20 or nbr_paths >300:
            print("break")
            break
        nbr_paths += 1

        edges = []
        # On extrait et traite chaque arêtes du chemin
        for i in range(len(path) - 1):
            u, v = path[i], path[i + 1]
            if not isinstance(u, (str, int, tuple)) or not isinstance(v, (str, int, tuple)):
                print(f"nœud non hashable : {u}, {v}")
                continue
            label = G[u][v].get("label", "").split('/')[-1]
            pattern.append(label)
            edges.append({"from": u, "to": v, "label": label, 'length':500})

        if pattern in liste_patterns :
            continue
        

        nodes = []
        # On traite tous les noeuds du chemin
        for n in path:
            t = ""
            for _, v, edge_data in G.out_edges(n, data=True):  # arêtes sortantes de n
                if "title" in edge_data.get("label", ""):
                    t = v 
                    break
            
            # On attribue à chaque noeud un id, un label et un groupe pour les classer par type.
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
        liste_res.append({"nodes": nodes, "edges": edges,"longueur":len(nodes)-1,'pattern':pattern, 'path':texte})

    
    
    # Indice simplicity, popularity, diversity
    ## Score
    a = 0.2
    b = 0.5
    c = 1 - a - b
    
    
    ## Simplicity
    liste_S_simplicity = []
    min_S_sim = sys.maxsize
    max_S_sim = 0
    
    ## Popularity
    page_rank_allnodes = nx.pagerank(G, alpha=0.85, weight='weight')
    liste_S_popularity = []
    min_S_pop = sys.maxsize
    max_S_pop = 0
    
    ## Diversity
    liste_S_diversity = []
    liste_max_j = []
    min_maxS_jac = sys.maxsize
    max_maxS_jac = 0
    
    for i in range(len(liste_res)):
        #S
        S_sim = 1/(len(liste_res[i]['edges']))
        liste_S_simplicity.append(S_sim)
        if S_sim < min_S_sim:
            min_S_sim = S_sim
        if S_sim > max_S_sim:
            max_S_sim = S_sim
        #P
        S_pop = (1/len(liste_res[i]['nodes']))
        sum_pagerank = 0
        for node in liste_res[i]['nodes']:
            sum_pagerank += page_rank_allnodes[node['id']]
        S_pop *= sum_pagerank
        liste_S_popularity.append(S_pop)
        if S_pop < min_S_pop:
            min_S_pop = S_pop
        if S_pop > max_S_pop:
            max_S_pop = S_pop
            
        #D
        S_jac = 0
        max_S_j = 0
        for j in range(len(liste_res)):
            if i != j :
                S_jac = (len(list((set(node['id'] for node in liste_res[i]['nodes']) & set(node['id'] for node in liste_res[j]['nodes'])))))/ (len(list(set(node['id'] for node in liste_res[i]['nodes']) |
                                                                                                set(node['id'] for node in liste_res[j]['nodes']) )))
        
            if S_jac > max_S_j:
                max_S_j = S_jac
            
        if max_S_j < min_maxS_jac:
            min_maxS_jac = max_S_j
        if max_S_j > max_maxS_jac:
            max_maxS_jac = max_S_j

        liste_max_j.append(max_S_j)
            
    # Normalisation
    for i in range(len(liste_res)):
        #S
        if max_S_sim == min_S_sim:
            S_SIM= 1
        else:
            S_SIM = (liste_S_simplicity[i]-min_S_sim)/(max_S_sim - min_S_sim)
        
       
        liste_res[i]['S_sim'] = S_SIM
        liste_res[i]['Score'] = a*S_SIM
        
        #P
        if max_S_pop == min_S_pop:
            S_POP= 1
        else:
            S_POP = (liste_S_popularity[i]-min_S_pop)/(max_S_pop - min_S_pop)
        
       
        liste_res[i]['S_pop'] = S_POP
        liste_res[i]['Score'] += b*S_POP
        
        #D
        if max_maxS_jac == min_maxS_jac:
            MAX_J= 1
        else:
            MAX_J = (liste_max_j[i]-min_maxS_jac)/(max_maxS_jac - min_maxS_jac)
        
        S_D = 1.0 - MAX_J
        liste_S_diversity.append(S_D)
        liste_res[i]['S_div'] = S_D
        liste_res[i]['Score'] += c*S_D
        
    
        
        
        

        
    print(f"min : {min_maxS_jac}, max: {max_maxS_jac}")

    
    
    """   
    # Enregistrer les valeurs dans liste_res
    for i in range(len(liste_res)):
        liste_res[i]['S_sim'] = liste_S_simplicity[i]
        liste_res[i]['S_pop'] = liste_S_popularity[i]
        liste_res[i]['S_div'] = liste_S_diversity[i]
        liste_res[i]['Score'] = a*liste_S_simplicity[i] + b*liste_S_popularity[i] + c*liste_S_diversity[i]
    """  
    


    # Appliquer à ces chemins sélectionnés les indexs Jaccard et Random Walk based
    ## Random walk based :
    liste_S_rw = []
    min_S_rw = sys.maxsize
    max_S_rw = 0
    poidsMax = 25*len(predicats(G))
    for p in liste_res:
        S_rw = 1
        l_nodes = p['nodes']
        for i_node in range(1,len(l_nodes)):
            S_rw *= 0.5*poidsMax/(G.out_degree(l_nodes[i_node - 1]['id'])*G[l_nodes[i_node - 1]['id']][l_nodes[i_node]['id']]["weight"])

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
        if max_S_rw == min_S_rw:
            S_RW= 1
        else:
            S_RW = (liste_S_rw[i]-min_S_rw)/(max_S_rw - min_S_rw)
        liste_S_rw [i] = S_RW
        liste_res[i]['S_rw'] = S_RW
        liste_res[i]['S_final'] = a*S_RW

    
     

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
        S_jac /= (len(liste_res))

        if S_jac < min_S_jac:
            min_S_jac = S_jac
        if S_jac > max_S_jac:
            max_S_jac = S_jac

        p['S_jac']=S_jac
        liste_S_jac.append(S_jac)

    ## Normalisation
    for i in range(len(liste_S_jac)):
        if max_S_jac != min_S_jac:
            S_JAC = (liste_S_jac[i]-min_S_jac)/(max_S_jac - min_S_jac)
        else:
            S_JAC = 1
        liste_S_jac[i] = S_JAC
        liste_res[i]['S_jac'] = S_JAC
        liste_res[i]['S_final'] += b*S_JAC

    # Trier liste_res en fct de la longueur
    liste_res.sort(key=lambda path: path['longueur'])

    return {'path' : liste_res[0],'all_paths':liste_res} #Soit [0] pour garder le chemin principal en bas, soit .pop(0)




def compute_all_paths_data_len(G, user, course,max=6):
    """
    Permet de récupérer tous les chemins simples de longuer inférieure à max dans le graphe entre l'utilisateur et le cours qui lui est recommandé.
    Entrée : 
    - G : un DiGraph
    - user : str, l'utilisateur
    - course : str, le cours recommandé
    - max : int, la longueure maximale des chemins à trouver
    Sortie : 
    - paths : generator
    """
    
    try:
        user = "https://coursera.graph.edu/"+user
        course = "https://coursera.graph.edu/" + course
        paths = nx.all_simple_paths(G, source=user, target=course, cutoff=max-1)
        return paths
    except nx.NetworkXNoPath:
        return None

def bounded_simple_paths(G, user, course, cutoff=None, max_paths=300, max_patterns=20):
    """
    Générateur de chemins simples entre source et target avec arrêt anticipé.
    """    
    user = "https://coursera.graph.edu/"+user
    course = "https://coursera.graph.edu/"+course
    
    if cutoff is None:
        cutoff = len(G) - 1

    visited = [user]
    stack = [(iter(G[user]), 0)]  # (iterator des voisins, profondeur)
    found_paths = 0
    found_patterns = set()

    while stack:
        children, depth = stack[-1]
        try:
            child = next(children)
            if child in visited:
                continue

            visited.append(child)
            if child == course:
                # chemin trouvé
                path = list(visited)  
                yield path
                found_paths += 1

                if found_paths >= max_paths:
                    return

            elif depth + 1 < cutoff:
                stack.append((iter(G[child]), depth + 1))
                continue

            visited.pop()
        except StopIteration:
            stack.pop()
            visited.pop()




def predicats(G):
    """
    Permet de récupérer le label de l'ensemble des arrêtes du graphe
    Entrée : 
    - G : DiGraph
    Sortie : 
    - liste : list, la liste comportant l'ensemble des labels des arêtes."""
    liste = []
    for u,v,e in G.edges(data=True):
        l=e.get("label","")
        if l not in liste:
            liste.append(l)
    return liste

def predicats_node(G, node):
    """
    Permet de récupérer le label de l'ensemble des arrêtes du graphe
    Entrée : 
    - G : DiGraph
    - node : str, noeud dont on cherche les prédicats sortants.
    Sortie : 
    - liste : list, la liste comportant l'ensemble des labels des arêtes."""
    liste = []
    for u,v,e in G.edges(data=True):
        if u==node:
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
    """
    Permet lors d'un clique sur un noeud du graphe d'afficher tous les voisins sortants de celui-ci ou seulement ceux correspondant aux prédicats sééctionnés.
    """
    
    # On récupère les paramètres de la requête
    data = request.get_json()
    predicates = data.get('predicates', [])

    user = request.args.get("start")
    course = request.args.get("end")
    node_id = request.args.get("voisin")
    choix = request.args.get("choix")
    if not user or not course or not node_id:
        return jsonify({"error": "Missing parameters"}), 400

    
    # Si le noeud cliqué n'existe pas dans le graphe
    if node_id not in G:
        node_id = quote(node_id, safe=":/")
        if node_id not in G:
            return jsonify({"error": f"No such node: {node_id}"}), 404

    graph = G

    json_chemin = {"nodes":[],"edges":[]}
    liste_voisins= list(graph.successors(node_id))
    
    # Pour chaque voisin sortant, on crée le noeud dans le graphe
    for n in liste_voisins:
        label = graph[node_id][n].get("label", "").split('/')[-1]
        ignorer = False
        """if len(predicates)==0:
            ignorer = True
        else:
            ignorer = False"""

        # Si le label est une URL on le conserve, sinon on le simplifie
        if 'url' in label:
            nom_label = n
        else:
            nom_label = n.split('/')[-1]

        if (label in predicates or ignorer):
            # Chercher le titre
            t = ""
            for _, v, edge_data in graph.out_edges(n, data=True):  # arêtes sortantes de n
                if "title" in edge_data.get("label", ""):
                    t = v 
                    break # Si titre trouvé : on sort de la boucle

            # Si pas de titre trouvé
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
            

            # On ajoute l'arête dans le graphe
            json_chemin["edges"].append({"from": node_id, "to": n, "label": label})


    return jsonify(json_chemin)


@app.route("/api/voisins")
def api_voisins():
    """
    Permet de récupérer tous les voisins d'un noeud, sans les afficher sur la graphe.
    """
    
    #On récupère le noeud cliqué
    node_id = request.args.get("voisin")
    choix = request.args.get("choix")
    if not node_id:
        return jsonify({"error": "Missing parameters"}), 400

    graph = G
   
    if node_id not in G:
        node_id = quote(node_id, safe=":/")
        if node_id not in G:
            return jsonify({"error": f"No such node: {node_id}"}), 404

    # On cherche tous les voisins sortants du noeud cliqué
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

@app.route("/api/path")
def api_path():
    """
    Permet de trouver et d'envoyer au front les chemins simples trouvés.
    """
    
    # Récupérer les paramètres
    user = request.args.get("start")
    course = request.args.get("end")
    w = request.args.get("w")
    choix = request.args.get("choix")
    a = 0.5
    b = 1 - a

    if not user or not course:
        return jsonify({"error": "start and end required"}), 400
    
    # On trouve les chemins simples
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

@app.route("/api/all_path")
def api_all_path():
    """
    Récupère tous les sous chemins trouvés par la fonction compute_all_paths_data_index et les envoie au front-end.
    """
    
    a = 0.5
    b = 1 - a
    user = request.args.get("start")
    course = request.args.get("end")
    choix = request.args.get("choix")

    if not user or not course:
        return jsonify({"error": "start and end required"}), 400

    
    if not all_paths_res:
        return jsonify({"error": "no path found"}), 404


    return jsonify(all_paths_res['all_paths'])


@app.route("/api/predicats")
def api_predicats():
    """
    Permet de récupérer l'ensemble des labels des prédicats du graphe.
    """

    global data 
    data = predicats(G)
    
    if not data:
        return jsonify({"error": "no predicat found"}), 404


    return jsonify(data)

@app.route("/api/predicats_node")
def api_predicats_node():
    """
    Permet de récupérer l'ensemble des labels des prédicats du noeud donné en paramètre.
    """

    node = request.args.get('node')
    data_node = predicats_node(G, node)
    data_node.sort()

    # Retourne toujours une liste
    return jsonify(data_node)


@app.route("/api/random_course")
def api_random_course():
    """
    Permet de générer une recommandation de cours aléatoirement.
    """
    
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

@app.route("/api/top5")
def api_find_top5():
    """
    Permet de récupérer le top 5 des attributs sémantiques par similarité.
    """
    
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

### Version CSV
"""
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


@app.route('/api/user_study', methods=['POST'])
def receive_user_study():
    """
    Permet de recevoir les réponses des questions de l'étude utilisateur et de créer un fichier json stockant ces réponses.
    """
    
    import json
    data = request.get_json()
    
    user_study = data.get('user_study', [])
    user_id = data.get('user_id', "")
    print("User study reçue :", user_study,", user id :", user_id)

    # Nom du fichier JSON de sortie
    filename = f"{user_id}_study_answers.json"

    # Correspondance question
    liste_question_possible = {'answer0':'This explanation path lets me judge when I should trust the recommendation system.',
                               'answer1':'Without adding or modifying the graph, the recommendation path gives me enough insight into why this course was proposed to me.',
                               'answer2':'This explanation path has irrelevant details, which make it overwhelming/difficult to understand.',
                               'answer3':'This explanation path seems generic.',
                               'answer4': 'This explanation path seems seems aligned with my personal interests.'
                        }

    # Structure de base
    feedback_data = {
        "user": user_id,
        "general feedback": {},
        "path feedback": []
    }

    print("Type de user_study :", type(user_study))
    print("Contenu de user_study :", user_study)



# Traitement du feedback général
    general_feedback = user_study.get('general_feedback', {})
    for question, answer in general_feedback.items():
        feedback_data["general feedback"][question] = answer

    # Traitement du feedback par chemin
   # Traitement du feedback par chemin
    path_feedback = user_study.get('path_feedback', {})
    for path_key, path_info in path_feedback.items():
        path_dict = {
            "longueur": path_info.get("longueur"),
            "path": path_info.get("path"),
            "S_jac": path_info.get("S_jac"),
            "S_rw": path_info.get("S_rw"),
            "S_tot": path_info.get("S_tot")
        }
        # Ajout des réponses avec remplacement answerX par la question
        for ans_key, ans_value in path_info.items():
            if ans_key.startswith("answer"):
                question_text = liste_question_possible.get(ans_key, ans_key)
                path_dict[question_text] = ans_value

        feedback_data["path feedback"].append(path_dict)



    # Sauvegarde JSON
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(feedback_data, f, ensure_ascii=False, indent=4)

    return jsonify({"status": "success", "message": f"Data saved for {user_id}"})


if __name__ == "__main__":
    app.run(debug=True)



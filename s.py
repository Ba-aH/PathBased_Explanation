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
        json_chemin["edges"].append({"from": node_id, "to": n, "label": label}) # modif !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! 11/07/2025


    return jsonify(json_chemin)

























data = data2.path;
                            var texte = data2.texte;
                            document.getElementById('Explication').innerHTML = texte;
                            console.log("Path : ", data2);
                            path = {
                                nodes: [...data.nodes],
                                edges: [...data.edges]
                            };
                            network.setData(data);
                            // Ne lancer all_path que quand path a fini et retourné une réponse
                            const container = document.getElementById("g_petit-container");
                            container.innerHTML = "";  // Nettoyer l'ancien contenu
                            return fetch(`http://localhost:5000/api/all_path?start=${user}&end=${course}&w=true&choix=${choix}`);
                        })
                        .then(res => res.json())
                        .then(data2 => {
                            const container = document.getElementById("g_petit-container");

                            console.log("all paths from ", user, " to ", course, " : ", data2);
                            document.getElementById("titre2").innerHTML = "Autres chemins possibles";


                            data2.forEach((p, i) => {
                                const div = document.createElement("div");
                                div.className = "g_petit";
                                div.id = "g" + i;
                                container.appendChild(div);

                                // Création block de questions
                                const button_answer = document.createElement('button');
                                button_answer.className = 'button';
                                button_answer.id = 'buttonAnswer' + i;
                                button_answer.innerHTML = 'Answer';
                                container.appendChild(button_answer);

                                const div_questions = document.createElement("div");
                                div.className = "divQuestions";
                                div.id = "Questions" + i;

                                const liste_answer_possible = ['strongly agree', 'agree', 'neutre', 'disagree', 'strongly disagree'];
                                const liste_question_possible = {
                                    '': ['This explanation lets me judge when I should trust the recommendation system.',
                                        'This explanation of how the recommendation system works has sufficient detail.',
                                        'This explanation of how the recommendation system works has irrelevant detail.'],
                                    'Based on the share of semantic attributes between the recommended movie and your interest in these semantic attributes, :':
                                        ['This is a good recommendation',
                                            'I will follow this course', 'I can determine how well I will like this course']
                                }
                                var i_qt = 0;
                                for (elt of Object.keys(liste_question_possible)) {

                                    const div = document.createElement("div");
                                    div.innerHTML = elt;
                                    div_questions.appendChild(div);
                                    
                                    for (qt of liste_question_possible[elt]) {
                                        var i_answer = 0;
                                        const question = document.createElement("div");
                                        question.innerHTML = qt;
                                        div_questions.appendChild(question);
                                        for (reponse of liste_answer_possible) {
                                            const input = document.createElement("input");
                                            input.type = "radio";
                                            input.id = 'answer'+i+(i_qt)+(i_answer++);
                                            input.name = 'answer';
                                            input.className = "myCheckbox";////////////////////////////?????????????????????????
                                            input.value =reponse;

                                            const label = document.createElement("label");
                                            label.for = liste[liste.length - 1];
                                            label.appendChild(input);
                                            label.innerHTML += reponse;

                                            ++i_qt;
                                        }
                                        
                                    }



                                }
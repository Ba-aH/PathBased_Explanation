
<!DOCTYPE html>

<html lang="fr">

<head>
    <meta charset="utf-8" />
    <meta content="width=device-width, initial-scale=1.0" name="viewport" />
    <title>ExplainGraph</title>
    <!-- External libraries -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/vis/4.21.0/vis.min.js"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/vis/4.21.0/vis.min.css" rel="stylesheet" />
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://code.jquery.com/jquery-3.4.1.min.js"></script>
    <!-- App styles -->
    <link href="styles.css" rel="stylesheet" />
</head>

<body>
    <!-- Conteneur principal à 3 colonnes -->
    <div class="extracted-style-1" id="main-layout">
        <!-- Barre de navigation -->
        <div class="extracted-style-2" id="nav-bar">
            <div>
                <h1>ExplainGraph </h1>
            </div>
            <div class="extracted-style-3"><img alt="Description de l'image" height="50" src="./liris.png" /></div>
            <div class="extracted-style-4">
                <a href="https://liris.cnrs.fr/equipe/tweak">About</a>
            </div>
        </div>
        <!-- Fenêtre de connexion -->
        <div id="login-overlay">
            <div id="login-box">
                <h2>General Information</h2>

                <p class="consent-text">
                    You are invited to participate in a study to evaluate a course recommendation system and the
                    associated explanations.
                    Participation is voluntary, and you may withdraw at any time. Your responses are anonymous and used
                    only for research purposes.
                </p>

                <form id="participant-form" onsubmit="event.preventDefault(); validateLogin();">
                    <div class="form-grid">
                        <!-- User ID (requis) + autocomplete -->
                        <div class="form-field">
                            <label for="userId">User ID <span class="req">*</span></label>
                            <input id="userId" placeholder="user_X.0" type="text" autocomplete="off" required />
                            <!-- Autocomplete dropdown (conservé) -->
                            <ul class="extracted-style-5" id="userId-suggest"></ul>
                        </div>

                        <!-- Age -->
                        <div class="form-field">
                            <label for="age">Age</label>
                            <input id="age" type="number" min="10" max="120" />
                        </div>

                        <!-- Gender -->
                        <div class="form-field">
                            <label>Gender</label>
                            <div class="radio-group">
                                <label class="radioOption"><input type="radio" name="gender" value="Female" />
                                    Female</label>
                                <label class="radioOption"><input type="radio" name="gender" value="Male" />
                                    Male</label>
                                <label class="radioOption"><input type="radio" name="gender" value="Prefer not to say"
                                        checked /> Prefer not to say</label>
                            </div>
                        </div>

                        <!-- Education level -->
                        <div class="form-field">
                            <label for="educationLevel">Education level</label>
                            <select id="educationLevel">
                                <option value="">-- Select --</option>
                                <option>High school</option>
                                <option>Bachelor</option>
                                <option>Master</option>
                                <option>PhD</option>
                                <option>Other</option>
                            </select>
                            <input id="educationOther" class="hidden" type="text" placeholder="Please specify" />
                        </div>

                        <!-- Field of study / work -->
                        <div class="form-field">
                            <label for="fieldStudy">Field of study / work</label>
                            <input id="fieldStudy" type="text" placeholder="e.g., Computer Science" />
                        </div>

                        <!-- Have you ever used a course recommendation system? -->
                        <div class="form-field">
                            <label>Have you ever used a course recommendation system?</label>
                            <div class="radio-group">
                                <label class="radioOption"><input type="radio" name="usedReco" value="Yes" />
                                    Yes</label>
                                <label class="radioOption"><input type="radio" name="usedReco" value="No" /> No</label>
                            </div>
                        </div>

                        <!-- Frequency of e-learning platform use -->
                        <div class="form-field">
                            <label for="frequency">Frequency of e-learning platform use</label>
                            <select id="frequency">
                                <option value="">-- Select --</option>
                                <option>Rarely</option>
                                <option>Sometimes</option>
                                <option>Often</option>
                                <option>Very often</option>
                            </select>
                        </div>
                    </div>

                    <p class="consent-note">
                        We will show you a recommended course along with an explanation (in the form of knowledge graph
                        paths).
                        Please read the recommendation and explanation carefully and then answer the questions below
                        based on what you saw.
                    </p>

                    <button class="button" type="submit">Start</button>
                </form>
            </div>
        </div>

        <!-- Zone de contenu principale -->
        <div class="extracted-style-6" id="content-area">
            <!-- Colonne centrale : graphe et contrôles -->
            <div class="extracted-style-7" id="center-panel">
                <div id="affichage-cours"></div>
                <!-- Controle du graphe -->
                <div class="graph-controls">
                    <button class="button" id="resetView"
                        title="Click here to recenter the graph and adjust the zoom">Recenter The Graph</button>
                    <button class="button" id="resetPath"
                        title="Click here to come back to the initial path explanation">Reset Path</button>
                    <input id="node" placeholder="course_xx, user_xx,..." type="text" />
                    <button class="button" onclick="chercherNode()"
                        title="Enter a node's name and click here to show its position in the graph">Find A
                        Node</button>

                    <button class="button" id="exportSvg"
                        title="Export the current graph as SVG in a new tab and start a download automatically">Export
                        SVG</button>
                </div>
                <div>Click on a node to extend the graph by showing its neighbors. You can explore the neighborhood of
                    nodes more precisely by selecting which predicates to display.</div>
                <!-- Graphe et boutons navigation -->
                <div id="graphs-container">
                    <button class="navigation extracted-style-8" id="buttonPrecedent">
                    </button>
                    <div id="graph-wrapper">
                        <div class="g" id="graph"></div>
                    </div>
                    <button class="navigation extracted-style-8" id="buttonSuivant"></button>
                </div>
                <!-- Informations sous le graphe -->
                <h3><u>Information about this path : </u></h3>
                <div id="num-chemin"></div>
                <div id="ligne-info-chemin">
                </div>
                <!-- Questions pour chaque chemin -->
                <div id="separateurChemin"></div>
                <div id="formulaire-questions"></div>
                <!-- Popup hover node-->
                <div class="extracted-style-9" id="tooltip">
                </div>
                <!-- Espace pour les questions générales -->
                <div id="separateurGeneral"></div>
                <div id="questionsGenerales"></div>
            </div>
            <!--  Colonne de droite : explication + légende -->
            <div class="extracted-style-10" id="right-panel">
                <!-- Explication textuelle -->
                <h3>Explanation</h3>
                <p id="Explication"></p>
                <!-- Legende des graphes -->
                <h4>Legend</h4>
                <ul class="extracted-style-11">
                    <li><span class="extracted-style-12"></span>
                        Topic</li>
                    <li><span class="extracted-style-13"></span>
                        User and recommended course</li>
                    <li><span class="extracted-style-14"></span>
                        Course</li>
                    <li><span class="extracted-style-15"></span>
                        Type</li>
                    <li>
                        <div class="extracted-style-16">
                            <div id="legendLiteral">
                                Literal
                            </div>
                            <span>Literal</span>
                        </div>
                    </li>
                </ul>
                <!-- Diagramme top 5 attributs sémantiques -->
                <h4>Top 5 Semantic Attributes</h4>
                <p>This bar chart shows what percentage of the user's high interest courses shares the same semantic
                    attributes as the recommended course. This chart only shows the top 5, non-zero percentages.</p>
                <div id="messageTop5"></div>
                <canvas height="200" id="top5chart" width="260"></canvas>
            </div>
        </div>
    </div>
    <!-- Loader -->
    <div id="loader" class="loader-overlay" style="display: none;">
        <div class="spinner"></div>
    </div>
    <!-- App script -->
    <script src="app.js"></script>
</body>

</html>

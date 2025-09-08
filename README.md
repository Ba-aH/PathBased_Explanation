# ExplainGraph (html Version)

**Instructions :**
- Ouvrir deux terminaux séparés et exécuter les commandes suivantes :
  * python -m http.server 8000
  * python server.py
- Accéder ensuite à l'adresse : http://localhost:8000/index.html

**Fonctionnement :**
- Lors de l'arrivée sur la page, saisir l’identifiant du user dans le champ User, puis cliquer sur "Confirm".
   * L'affichage peut prendre une dizaine de secondes (le traitement porte sur ~10 000 chemins en moyenne). Si la page de connexion disparait et que vous voyez un cours recommandé alors l'explication va bientôt apparaître.
   * Si vous voyez en dessous de la fenêtre de visualisation des chemins les informations portants sur ce chemin, mais vous ne voyez pas le chemin (arrive si vous changez de page pendant le chargement des chemins), appuyez sur "Recenter the graph" pour que celui-ci soit de nouveau au milieu de la fenêtre.

- Une fois les chemins chargés et affichés dans la fenêtre de visualisation, vous pouvez interragir avec ceux-ci.
   * Vous pouvez déplacer les noeuds du graphe.
   * En passant votre souris au dessus d'un noeud de type "course", vous pouvez observer le titre de ce dernier.

- En cliquant sur un nœud du graphe, une fenêtre apparait pour sélectionner quels prédicats suivre pour afficher les voisins sortants du noeud cliqué. Si un noeud a déjà été cliqué une première fois, le second clic sur le même nœud masque tous les voisins ajoutés. 
  * Vous pouvez plus rapidement séléctionner ou déséléctionner tous les prédicats en utilisant respectivement les boutons "Select all" et "Unselect all".

- Vous pouvez à tout moment utiliser le bouton "Recenter the graph" pour recentrer le graphe dans la fenêtre de visualisation et ajuster le zoom automatiquement.

- En cliquant sur "Reset Path" vous pouvez à tout moment revenir au chemin initial, celui obtenu avant d'avoir étendu le graphe en affichant les voisins de certains noeuds.

- En cliquant sur "Find A Node" vous pouvez zoomer , s'il existe, sur le noeud dont vous devez fournir le nom dans la zone de texte à gauche du bouton.

- Naviguez entre les différents chemins d'explication avec les flèches [<] et [>] de part et d'autres de la fenêtre de visualisation pour comprendre d'avantages la recommandation.
  * En dessous de la fenêtre de visualisation se trouvent pour chaque chemin, des informations le concernant.

- Pour chaque chemin, répondre aux questions qui se trouvent en dessous des informations de celui-ci. Une fois que vous avez répondu à l'ensemble des questions, pensez bien à valider vos réponses avec le bouton "Validate".
  * Si la validation s'est bien passée, un message confirmant l'enregistrement des réponses s'affichera sur l'écran.

- Des explications supplémentaires se trouvent dans la colonne de droite. Après avoir observé ces explications, vous devez répondre aux questions générales, situées sous les questions portant sur chaque chemin. Une fois l'ensemble des questions répondues (générales mais aussi pour chaque chemin), appuyez sur le bouton "Save" pour enregistrer l'ensemble de vos réponses. 
  * Si la page vous indique que les réponses ont bien été envoyées alors l'étude utilisateur est finie.

 

# ExplainGraph (html Version) - English Version

**Instructions :**
- Open two separate terminals and run the following commands:
  * `python -m http.server 8000`
  * `python server.py`
- Then, go to: [http://localhost:8000/page3D3.html](http://localhost:8000/page3D3.html)

**How it works :**
- When the page loads, enter the user ID in the **User** field and click **"Confirm"**.
  * The display may take around ten seconds (the process runs on ~10,000 paths on average). If the login screen disappears and you see a recommended course, the explanation will appear shortly.
  * If you see the information about the path below the visualization window but the path itself is not displayed (this can happen if you switch pages while paths are loading), click **"Recenter the graph"** to bring it back to the center of the window.

- Once the paths are loaded and displayed in the visualization window, you can interact with them:
  * You can drag the graph’s nodes.
  * Hovering over a **course** node shows its title.

- Clicking on a node opens a window where you can select which predicates to follow in order to display that node’s outgoing neighbors.  
  If a node has already been clicked once, clicking it again hides all the added neighbors.
  * You can quickly select or unselect all predicates using the **"Select all"** and **"Unselect all"** buttons.

- You can use the **"Recenter the graph"** button at any time to bring the graph back to the center of the visualization window and automatically adjust the zoom.

- Clicking on **"Reset Path"** restores the initial path, i.e., the one obtained before expanding the graph by displaying neighbors of certain nodes.

- Clicking on **"Find A Node"** zooms in on the specified node (if it exists).  
  Enter the node’s name in the text box to the left of the button.

- Navigate between the different explanation paths using the **[<]** and **[>]** arrows on either side of the visualization window to better understand the recommendation.
  * Below the visualization window, you’ll find specific information for each path.

- For each path, answer the questions displayed below its information. Once you’ve answered all the questions, make sure to validate your answers using the **"Validate"** button.
  * If the validation is successful, a confirmation message will appear on screen.

- Additional explanations are shown in the right-hand column. After reviewing them, you must also answer the **general questions**, located below the path-specific questions.  
  Once you’ve answered **all** questions (both path-specific and general), click the **"Save"** button to submit your responses.
  * If the page confirms that your answers were successfully sent, the user study is complete.

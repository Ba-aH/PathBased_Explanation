**Instructions :**
- Ouvrir deux terminaux séparés et exécuter les commandes suivantes :\
_premier terminal_:
  * cd my-vue-app
  * npm run dev\
  _deuxieme terminal_:
  * python server.py
- Modifier la visibilité du port 5000 à _public_
- Accéder ensuite à l'adresse affichée sur le premier terminal

**Fonctionnement :**
- Saisir l’identifiant du user dans le champ User, puis cliquer sur Afficher le chemin.
   * L'affichage peut prendre une dizaine de secondes (le traitement porte sur ~10 000 chemins en moyenne). Évitez de cliquer plusieurs fois si rien ne s’affiche immédiatement.

- Il est possible de modifier la pondération du graphe :
  * Faites un glisser-déposer des prédicats importants dans la zone grise, cliquez sur Appliquer prédicats, puis sur Afficher le chemin.

- En cliquant sur un nœud du "grand graphe", ses voisins apparaissent. Un second clic sur le même nœud les masque.
  * Vous pouvez choisir les types d’arêtes sortantes à afficher via les checkboxs en dessous.

- En cliquant sur les petits chemins en bas :
  * Mode Ajout Graphe Activé : le chemin est ajouté au grand graphe.

  * Mode Échange Graphe Activé : seul le chemin sélectionné apparaît dans le grand rectangle.
(Cela permet d’explorer les petits chemins de façon interactive.)

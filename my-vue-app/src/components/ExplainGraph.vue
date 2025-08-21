

<script setup>
import * as d3 from 'd3';
import { ref, reactive, onMounted, nextTick } from 'vue'
import Chart from 'chart.js/auto'

// Références réactives
const user = ref('')
const course = ref('')
const searchNode = ref('')
const explanation = ref('')
const top5Message = ref('')
const mode = ref('Mode Ajout Graphe Activé')
const graphEl = ref(null)
let top5ChartInstance = null

const legend = reactive({
  'Topic': 'rgb(236, 112, 90)',
  'User and recommended course': 'rgb(67, 143, 206)',
  'Course': 'rgb(245, 221, 6)',
  'Type': '#bce98f'
})

// Placeholders de données, à lier au graphe plus tard
let network = ref(null) // créé dans onMounted()
let graphCtx = ref(null)
const graphData = reactive({ nodes: [], edges: [] })

let liste_node_click = reactive([]);
const API_URL = "https://fuzzy-winner-x599rgwgjrgj3p7gx-5000.app.github.dev/"

let data = reactive({
  nodes: [],
  edges: []
});

let parent = reactive({})
let path2_en_cours = false
let path2 = reactive({
      nodes: [],
      edges: []
    });
let path = reactive({
      nodes: [],
      edges: []
    });


const predicats = ref([]); // tableau réactif pour les prédicats


const dataPaths = ref([])   // data2 de ton fetch
const indexPathAffiche = ref(0)

const reponseUserStudy = reactive({
  path_feedback: {},
  general_feedback: {}
})

const liste_answer_possible = ['strongly agree', 'agree', 'neutre', 'disagree', 'strongly disagree'];
const questions_reponses_generales = {
    "Do you think explanations, either graph, diagram or text-based, are useful ?": liste_answer_possible,
    "Which explanation format do you prefer ?": ["graph-based", "text-based", "bar chart"],
    "Adding context to the explanations (neighborhood of the path’s nodes) is useful": liste_answer_possible,
    "Interacting with the other paths by using the Swap Path mode helps me understand better why this course was recommended to me.": liste_answer_possible,
    "Interacting with the other paths by using the Add Path mode helps me understand better why this course was recommended to me.": liste_answer_possible,
    "Choosing which predicates to display when exploring the path’s neighborhood is useful.": liste_answer_possible,
    'Based on the share of semantic attributes between the recommended course and your interest in these semantic attributes (in the top 5 chart):': [],
    "This is a good recommandation.": liste_answer_possible,
    "I will follow this course.": liste_answer_possible,
    "I can determine how well I will like this course.": liste_answer_possible

};
const liste_question_possible = {
    '': ['This explanation path lets me judge when I should trust the recommendation system.',
        'Without adding or modifying the graph, the recommendation path gives me enough insight into why this course was proposed to me.',
        'This explanation path has irrelevant details, which make it overwhelming/difficult to understand.',
        'This explanation path seems generic.',
        'This explanation path seems seems aligned with my personal interests.']
}



const drawGraph = (container, nodes, edges) => {
      if (!container) {
        console.error("Élément #graph-container introuvable.");
        return;
      }
      container.innerHTML = "";

      let width = container.clientWidth || 600;
      let height = container.clientHeight || 400;

      if (container.parentElement && container.parentElement.style.display === "none") { /////////////////////////////////////////////////////////////////??????????
        const oldDisplay = container.parentElement.style.display;
        container.parentElement.style.display = "block";
        void container.parentElement.offsetWidth; // forcer reflow
        width = container.clientWidth || 600;
        height = container.clientHeight || 400;
        container.parentElement.style.display = oldDisplay;
      }

      const svg = d3.select(container)
        .append("svg")
        .attr("width", width)
        .attr("height", height);

      const zoomGroup = svg.append("g").attr("class", "zoom-group");
      const linkGroup = zoomGroup.append("g").attr("class", "links");
      const nodeGroup = zoomGroup.append("g").attr("class", "nodes");
      const labelGroup = zoomGroup.append("g").attr("class", "labels");
      const edgeLabelGroup = zoomGroup.append("g").attr("class", "edge-labels");

      // Définition de flèche
      svg.append("defs").append("marker")
        .attr("id", "arrow")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 25)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .attr("markerUnits", "userSpaceOnUse")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "#999");


      d3.select("svg").style("pointer-events", "all");
      d3.select("g.zoom-group").style("pointer-events", "all");
      d3.selectAll(".nodes circle").style("pointer-events", "all");

      const zoom = d3.zoom()
        .scaleExtent([0.1, 5])
        .on("zoom", (event) => {
          zoomGroup.attr("transform", event.transform);
        });

      svg.call(zoom);

      // Simulation
      const simulation = d3.forceSimulation()
        .force("link", d3.forceLink().id(d => d.id).distance(200))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2).strength(0.01));

      simulation.tick(50); // par exemple

      // Première update
      
      updateGraph(nodes, edges, { svg, linkGroup, nodeGroup, labelGroup, edgeLabelGroup, simulation, zoomGroup, zoom }  );

      return { svg, linkGroup, nodeGroup, labelGroup, edgeLabelGroup, simulation, zoomGroup, zoom };
    };

const updateGraph = (nodes, edges, infos) => {
  if (!infos) return;

  const { svg, linkGroup, nodeGroup, labelGroup, edgeLabelGroup, simulation ,zoomGroup, zoom} = infos;

  const edgesD3 = edges.map(e => ({ ...e, source: e.from, target: e.to }));

  nodes.forEach(n => {
    if (n.x == null) n.x = Math.random() * +svg.attr("width");
    if (n.y == null) n.y = Math.random() * +svg.attr("height");
  });

  simulation.nodes(nodes);
  simulation.force("link").links(edgesD3);
  simulation.alpha(1).restart();

  // Liens
  const linkSelection = linkGroup.selectAll("path").data(edgesD3, d => d.id || (d.source.id + "-" + d.target.id));
  linkSelection.exit().remove();
  const linkEnter = linkSelection.enter().append("path")
    .attr("fill", "none")
    .attr("stroke-width", 1.5)
    .attr("stroke", d => getNodeColor(d.source.group));
  const linkElements = linkEnter.merge(linkSelection);

  // Nœuds
  const nodeSelection = nodeGroup.selectAll(".node").data(nodes, d => d.id);
  nodeSelection.exit().remove();

  // Pour le popup title: 
  const attrs = {
      onNodeHover: function (value) {
          console.log("Hovered:", value);
      }
  };
  const tooltip = d3.select("#tooltip");

  const nodeEnter = nodeSelection.enter()
    .append(d => {
      if (d.label === d.id) {
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("rx", 5);
        rect.setAttribute("ry", 5);
        rect.setAttribute("fill", "#eee");
        rect.setAttribute("stroke", "#999");
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.textContent = d.label;
        text.setAttribute("x", 0);
        text.setAttribute("y", 0);
        text.setAttribute("dominant-baseline", "middle");
        text.setAttribute("text-anchor", "middle");
        g.appendChild(rect);
        g.appendChild(text);
        return g;
      } else {
        return document.createElementNS("http://www.w3.org/2000/svg", "circle");
      }
    })
    .classed("node", true)
    .each(function (d) {
      const isRect = d.label === d.id;
      const node = d3.select(this);
      if (isRect) {
          const g = d3.select(this);
          const text = g.select("text");
          const rect = g.select("rect");

          // On mesure le texte pour ajuster le rectangle autour
          const bbox = text.node().getBBox();

          rect
              .attr("x", bbox.x - 6)
              .attr("y", bbox.y - 4)
              .attr("width", bbox.width + 12)
              .attr("height", bbox.height + 8)
              .attr("fill", getNodeColor(d.group));

          // Position du texte (centré)
          text
              .attr("x", 0)
              .attr("y", 0)
              .attr("font-size", "10px");

      } else {
          node
              .attr("r", 8)
              .attr("fill", getNodeColor(d.group));
      }
  })

    .call(drag(simulation))
    .on("mouseover", (event, d) => {
      console.log("Node mouseover:", d.id);
      if (d.label === d.id) {
          d3.select(event.currentTarget).select('rect')
              .attr("stroke", "black")
              .attr("stroke-width", 3);
      } else {
          d3.select(event.currentTarget)
              .attr("stroke", "black")
              .attr("stroke-width", 3);
      }
      // popup title:
      const value = d.title ?? '';
      console.log("title = ",value);
      attrs.onNodeHover?.(d.title ?? '');
      if (value != '') {
          tooltip
              .style("display", "block")
              .html(value)
              .style("left", (event.pageX + 10) + "px")
              .style("top", (event.pageY + 10) + "px");
      }

  })
  .on("mouseout", (event, d) => {
      console.log("Node mouseout:", d.id);

      tooltip.style("display", "none");

      if (d.label === d.id) {
          d3.select(event.currentTarget).select('rect')
              .attr("stroke-width", 0);
      } else {
          d3.select(event.currentTarget)
              .attr("stroke-width", 0);
      }
  });
  const nodeElements = nodeEnter.merge(nodeSelection);

  // Labels et edge labels (similaire à ton code)
  const labelSelection = labelGroup.selectAll("text").data(nodes, d => d.id);
  labelSelection.exit().remove();
  const labelEnter = labelSelection.enter().append("text").text(d => d.label !== d.id ? d.label : '')
    .attr("font-size", "10px").attr("text-anchor", "middle").attr("dy", 15);
  const labelElements = labelEnter.merge(labelSelection);

  const edgeLabelSelection = edgeLabelGroup.selectAll("text").data(edgesD3, d => d.id || (d.source.id + "-" + d.target.id));
  edgeLabelSelection.exit().remove();
  const edgeLabelEnter = edgeLabelSelection.enter().append("text")
    .attr("font-size", "9px").attr("fill", "#555").attr("text-anchor", "middle")
    .text(d => d.label || "");
  const edgeLabelElements = edgeLabelEnter.merge(edgeLabelSelection);

  simulation.on("tick", () => {
    linkElements.attr("d", d => {
      const x1 = d.source.x;
      const y1 = d.source.y;
      const x2 = d.target.x;
      const y2 = d.target.y;

      const dx = x2 - x1;
      const dy = y2 - y1;
      const cx = x1 + dx / 2 + dy * 0.1; // ← ajout d’un petit décalage
      const cy = y1 + dy / 2 - dx * 0.1; // ← pour créer le "bend"
      return `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`;
    });

    nodeElements.each(function(d){
      const node = d3.select(this);
      if(d.label===d.id){
        node.attr("transform", `translate(${d.x},${d.y})`);
      } else {
        node.attr("cx", d.x).attr("cy", d.y);
      }
    });

    labelElements.attr("x", d => d.x).attr("y", d => d.y);
    edgeLabelElements.attr("transform", d => {
      const x = (d.source.x + d.target.x)/2;
      const y = (d.source.y + d.target.y)/2;
      const angle = Math.atan2(d.target.y - d.source.y, d.target.x - d.source.x) * 180/Math.PI;
      const correctedAngle = (angle > 90 || angle < -90) ? angle + 180 : angle;
      return `translate(${x},${y}) rotate(${correctedAngle})`;
    });
  });
};

const getNodeColor = (group) => {
  const colorMap = {
    0: "orange",
    1: "rgb(245, 221, 6)",
    2: "rgb(236, 112, 90)",
    3: "rgb(67, 143, 206)"
  };
  
  return colorMap[group] || "#bce98f"; // couleur par défaut si le groupe n'existe pas
};

/*
        function drag(simulation) {
            function dragstarted(event, d) {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                if (d.fy !== 100)
                    d.fy = d.y;
            }

            function dragged(event, d) {
                d.fx = event.x;
                if (d.fy !== 100)
                    d.fy = event.y;
            }

            function dragended(event, d) {
                if (!event.active) simulation.alphaTarget(0);
                d.fx = null;
                if (d.fy !== 100)
                    d.fy = null;
            }

            return d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended);
        }
*/
const drag = (simulation) => {
  return d3.drag()
    .on("start", (event, d) => {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    })
    .on("drag", (event, d) => {
      d.fx = event.x;
      d.fy = event.y;
    })
    .on("end", (event, d) => {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    });
};




const fetchPredicats = async () => {
  try {
    //const API_URL = "https://fuzzy-winner-x599rgwgjrgj3p7gx-5000.app.github.dev/"
    const res = await fetch(`${API_URL}/api/predicats`);
    if (!res.ok) throw new Error("Erreur HTTP " + res.status);

    const data = await res.json();
    console.log("all predicats:", data);

    // transformer les données pour Vue
    predicats.value = data.map((p) => {
      const parts = p.split("/");
      const name = parts[parts.length - 1];
      return { name, checked: false }; // v-model sur checked
    });
  } catch (err) {
    console.error("Erreur fetchPredicats:", err);
  }
};

const uncheckAll = () => {
  predicats.value.forEach((p) => (p.checked = false));
};

function orderNodesByEdges(nodes, edges) { // Permet d'afficher les petits chemins toujours dans le même ordre
            // Trouve le premier noeud (celui qui n'est pas dans 'to' d'une arête)
            const toNodes = new Set(edges.map(e => e.to));
            const fromNodes = new Set(edges.map(e => e.from));

            let startNode = nodes.find(n => !toNodes.has(n.id));
            if (!startNode) startNode = nodes[0]; // fallback

            const orderedNodes = [];
            let currentId = startNode.id;

            while (currentId !== undefined) {
                const currentNode = nodes.find(n => n.id === currentId);
                if (!currentNode) break;
                orderedNodes.push(currentNode);

                const nextEdge = edges.find(e => e.from === currentId);
                currentId = nextEdge ? nextEdge.to : undefined;
            }
            return orderedNodes;
        }

const loadPath = async () => {
  if (!user.value) {
    alert("Veuillez entrer un nom d'utilisateur.")
    return
  }

  try {
    // 1. Obtenir cours recommandé
    console.log('hey')


    //const API_URL = "https://fuzzy-winner-x599rgwgjrgj3p7gx-5000.app.github.dev/"
    const courseResp = await fetch(`${API_URL}/api/random_course?start=${user.value}`)

    const courseData = await courseResp.json()

    if (courseData.error) {
      alert(courseData.error)
      return
    }

    if (!courseData) {
      alert("courseData == null")
      return
    }

    course.value = courseData.course
    document.getElementById("affichage-cours").innerHTML = `Cours recommandé : <strong>${course.value}</strong>`
    path2_en_cours = false;
    parent = {}
    path = { nodes: [], edges: [] };
    data = { nodes: [], edges: [] };
    updateGraph(
      data.nodes,
      data.edges,
      graphCtx.value
    );
    
  // 2. Charger chemin principal
    const pathResp = await fetch(`${API_URL}/api/path?start=${user.value}&end=${course.value}&w=true&choix=false`)
    const pathData = await pathResp.json()

    data.nodes = [...pathData.path.nodes]
    data.edges = [...pathData.path.edges]
    explanation.value = pathData.texte
    // Mise à jour des variables réactives
    path.nodes= [...data.nodes]
    path.edges = [...data.edges]
    updateGraph(
      data.nodes,
      data.edges,
      graphCtx.value
    );

  // 3. Charger petits chemins
  const res = await fetch(`${API_URL}/api/all_path?start=${user.value}&end=${course.value}&w=true&choix=false`)
  const smallPaths = await res.json()


  dataPaths.value = smallPaths.map((p, i) => ({
    ...p,
    showQuestions: false,
    repondu: false,
    answers: {},
    spacedNodes: [],
    petitgraphCtx: null
  }));

  // Attendre que Vue ait rendu les divs #g{i}
  await nextTick();

  // Maintenant seulement dessiner les graphes
  dataPaths.value.forEach((p, i) => {
    const container = document.getElementById("g" + i);
    if (!container) {
      console.warn("Pas trouvé le conteneur pour g" + i);
      return;
    }

    const orderedNodes = orderNodesByEdges(p.nodes, p.edges);
    const spacedNodes = orderedNodes.map((node, j) => ({
      ...node,
      x: j * 150,
      y: 0,
      fy: 100
    }));

    p.spacedNodes = spacedNodes;
    p.petitgraphCtx = drawGraph(container, spacedNodes, p.edges);
    

    // Observer les changements de taille du conteneur
    const resizeObserverSmallGraph = new ResizeObserver(entries => {
        for (let entry of entries) {
            const width = entry.contentRect.width;
            const height = entry.contentRect.height;

            console.log("Nouvelle taille du graphe :", width, height);

            // Re-rendre le graphe D3 ici
            updateGraphSize(width, height, p.petitgraphCtx.simulation, p.petitgraphCtx.svg);
        }
    });

    resizeObserverSmallGraph.observe(container);

    p.petitgraphCtx.svg.on('click',(event) => {
      console.log("click path");
      fitToGraph(p.petitgraphCtx.svg, p.petitgraphCtx.zoom);
      let pathNew = {
          nodes: [...orderedNodes],
          edges: [...p.edges]
      };


      if (mode.value == "Mode Ajout Graphe Activé") {
          // Exclure les doublons de nœuds
          const existingNodeIds = new Set(data.nodes.map(n => n.id));
          const newNodes = pathNew.nodes.filter(n => !existingNodeIds.has(n.id));

          var existingNodeIdsInPath = new Set(path.nodes.map(n => n.id));
          var newNodesPath = pathNew.nodes.filter(n => !existingNodeIdsInPath.has(n.id));
          if (path2_en_cours) {
              existingNodeIdsInPath = new Set(path2.nodes.map(n => n.id));
              newNodesPath = pathNew.nodes.filter(n => !existingNodeIdsInPath.has(n.id));
          }


          // Exclure les doublons d'arêtes (selon from/to ou id si défini)
          const existingEdgeKeys = new Set(data.edges.map(e => `${e.from}->${e.to}`));
          const newEdges = pathNew.edges.filter(e => !existingEdgeKeys.has(`${e.from}->${e.to}`));

          var existingEdgeKeysInPath = new Set(path.edges.map(e => `${e.from}->${e.to}`));
          var newEdgesPath = pathNew.edges.filter(e => !existingEdgeKeysInPath.has(`${e.from}->${e.to}`));
          if (path2_en_cours) {
              existingEdgeKeysInPath = new Set(path2.edges.map(e => `${e.from}->${e.to}`));
              newEdgesPath = pathNew.edges.filter(e => !existingEdgeKeysInPath.has(`${e.from}->${e.to}`));
          }

          console.log("existing nodes  u:", existingNodeIds);
          console.log("existin edges u:", existingEdgeKeys);
          console.log("pathNew:", pathNew);
          console.log("new nodes :", newNodesPath);
          console.log("new edges :", newEdgesPath);
          console.log("new nodes utilisé :", newNodes);
          console.log("new edges utilisé:", newEdges);
          console.log("data : ", data);

          // Fusionner les données
          data = {
              nodes: [...data.nodes, ...newNodes],
              edges: [...data.edges, ...newEdges]
          };

          if (path2_en_cours) {
              path2 = {
                  nodes: [...path2.nodes, ...newNodesPath],
                  edges: [...path2.edges, ...newEdgesPath]
              };
          } else {
              path2 = {
                  nodes: [...path.nodes, ...newNodesPath],
                  edges: [...path.edges, ...newEdgesPath]
              };
          }
          console.log('path total :', path2);


      } else {
          // Remplacer
          data = {
              nodes: [...pathNew.nodes],
              edges: [...pathNew.edges]
          };
          path2 = {
              nodes: [...pathNew.nodes],
              edges: [...pathNew.edges]
          };
          console.log('path2 swap:', path2);

      }
      path2_en_cours = true;

      //network.setData(data);
      updateGraph(data.nodes, data.edges, graphCtx.value    );
  })
  // Si click sur un path --> l'ajouter dans le grand graphe si Mode ajout, sinon echanger path general par celui-ci

});
  


  // 4. top5 :

  const top5res = await fetch(`${API_URL}/api/top5?user=${user.value}&course=${course.value}`)
  const top5 = await top5res.json()

  top5Message.value = "";
  console.log("DEBUG top5 raw data:", top5);
  if (Object.keys(top5).length == 0) {
      console.log("Aucun attribut en commun");
      document.getElementById("top5chart").style.display = "none";
      top5Message.value = "Aucun attribut en commun";
      return;
  }
  const labels = Object.keys(top5).map(uri => uri.split("/").pop()); // simplifier les noms
  const values = Object.values(top5).map(Number);
  console.log("top5 : ", top5);
  const ctx = document.getElementById('top5chart').getContext('2d');
  if (top5ChartInstance !== null) {
      top5ChartInstance.destroy();
  }
  top5ChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
          labels: labels,
          datasets: [{
              label: 'Similarity percentage',
              data: values,
              backgroundColor: 'rgba(255, 251, 222, 0.7)',
              borderColor: '#ada56a',
              borderWidth: 1
          }]
      },
      options: {
          responsive: true,
          scales: {
              y: {
                  beginAtZero: true,
                  max: 1
              }
          }
      }
  });
  document.getElementById("top5chart").style.display = "block";  // réaffiche si caché
  top5Message.value = "";
                        

  } catch (err) {
    alert("Erreur dans loadPath : " + err.message)
    console.error(err)
  }

}

function sendPredicatesToServer() {
  console.log("Envoi des prédicats")
}


function resetPredicats() { // Mettre à jour les prédicats (les enlever de la zone drop), mais aussi tout le reste (BUTTON REINITIALISER)
  console.log("Réinitialisation des prédicats")
  //document.getElementById('pagination').remove()
  document.getElementById("titre2").innerHTML = '';

  // Réinitialiser les variables globales
  path = { nodes: [], edges: [] };
  data = { nodes: [], edges: [] };
  parent = {};
  liste_node_click = [];

  // Nettoyer les graphes affichés
  updateGraph(data.nodes, data.edges,graphCtx.value);


  document.getElementById("g_petit-container").innerHTML = "";
  document.getElementById("affichage-cours").innerHTML = "";
  document.getElementById("top5chart").innerHTML = "";
  top5ChartInstance.destroy();
  document.getElementById("titre2").innerHTML = "";


  }


function resetView() {
  fitToGraph(graphCtx.value.svg, graphCtx.value.zoom);
}

/*
function fitToGraph(svg, zoomfunction) {
            svg.transition().duration(750).call(
                //zoom.transform,
                zoomfunction.transform,
                d3.zoomIdentity // <-- transform de base : scale=1, translate=[0,0]
            );
        }*/

function fitToGraph(svg, zoomfunction) {
            // container: le groupe 'g' contenant les noeuds et liens
            console.log("svg.node() =", svg.select('g.zoom-group').node());

            const bounds = svg.select('g.zoom-group').node().getBBox();
            const fullWidth = +svg.attr("width");
            const fullHeight = +svg.attr("height");

            const width = bounds.width;
            const height = bounds.height;
            const midX = bounds.x + width / 2;
            const midY = bounds.y + height / 2;

            const scale = 0.85 / Math.max(width / fullWidth, height / fullHeight); // 0.85 pour un peu de marge
            const translate = [fullWidth / 2 - scale * midX, fullHeight / 2 - scale * midY];

            svg.transition()
                .duration(750)
                .call(
                    zoomfunction.transform,
                    d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
                );
        }


function resetPath() {
  console.log("Réinitialisation du chemin")
  data.nodes = [...path.nodes]
  data.edges = [...path.edges]
                

                updateGraph(data.nodes, data.edges, graphCtx.value);
                fitToGraph(graphCtx.value.svg, graphCtx.value.zoom);

                for (const k of Object.keys(parent)) {
                    parent[k] = null;
                }
                liste_node_click = []
                // Recentrer après reset
                fitToGraph(graphCtx.value.svg, graphCtx.value.zoom);
                path2_en_cours = false;
}

function chercherNode() { // button Chercher node
            
            console.log('node : ',searchNode.value);
            for (const n of data.nodes) {
                console.log('n :', n.label);
                if (n.label == searchNode.value) {
                    const graph = graphCtx.value;
                    const width = +graph.svg.attr("width");
                    const height = +graph.svg.attr("height");
                    focusOnNode(graph, n.id, width, height);
                    return
                }
            }
            alert("Node non trouvé");
            return
        }



function focusOnNode(graph, nodeId, width, height) {
            const node = graph.simulation.nodes().find(n => n.id === nodeId);
            if (!node) return;

            // Mise en évidence (changer la couleur)

            graph.nodeGroup.selectAll("circle")
                .attr("stroke", d => d.id === nodeId ? "black" : null)
                .attr("stroke-width", d => d.id === nodeId ? 4 : null)
                .attr("fill", d => d.id === nodeId ? "limegreen" : (getNodeColor(d.group)));

            // Zoom centré sur le nœud (vers le centre de l'écran)
            const newZoom = d3.zoomIdentity
                .translate(width / 2, height / 2)
                .scale(1.5)
                .translate(-node.x, -node.y);

            graph.svg.transition().duration(750)
                .call(graph.zoom.transform, newZoom);

        }


function ajouterGraph() {
  mode.value = "Mode Ajout Graphe Activé"
  resetPath()
}

function echangerGraph() {
  mode.value = "Mode Echange Graphe Activé"
  resetPath()
}




function prevPath() {
  if (indexPathAffiche.value > 0) indexPathAffiche.value--
}

function nextPath() {
  if (indexPathAffiche.value < dataPaths.value.length-1) indexPathAffiche.value++
}

function validatePath(p) {
  console.log("validatePath")
  let unanswered = false;
  for (const qtGroup of Object.values(liste_question_possible)) {
    for (const qt of qtGroup) {
      if (!p.answers.hasOwnProperty(qt) || !p.answers[qt]) {
        unanswered = true;
        break;
      }
    }
    if (unanswered) break;
  }
  if (unanswered) {
    alert("Merci de répondre à toutes les questions.")
    return
  }
  p.repondu = true
  reponseUserStudy.path_feedback[p.pattern] = {
    ...p.answers,
    longueur: p.longueur,
    S_jac: p.S_jac,
    S_rw: p.S_rw,
    S_tot: p.S_final,
    path: p.path
  }
  p.showQuestions = false
}

function updateGraphSize(width, height, simulation, svg) { // Si modif taille de l'onglet
            svg
                .attr("width", width)
                .attr("height", height);

            // Si tu as un `simulation` (force layout), réactualise aussi
            simulation.force("center", d3.forceCenter(width / 2, height / 2).strength(0.01));
            simulation.alpha(1).restart();
        }

async function saveAll() {
  const allPathsAnswered = dataPaths.value.every(p => p.repondu)

    const allGeneralAnswered = Object.keys(questions_reponses_generales)
    .filter(q => questions_reponses_generales[q].length > 0) // ← on garde que celles avec options
    .every(q => reponseUserStudy.general_feedback[q]);


  if (!allPathsAnswered || !allGeneralAnswered) {
    alert("Merci de répondre à toutes les questions.")
    return
  }

  await fetch(`${API_URL}/api/user_study`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_study: reponseUserStudy, user_id: user.value })
  })
  alert("Réponses envoyées avec succès !")
}


onMounted(async () => {
  await fetchPredicats();
  console.log("Predicats après fetch:", predicats.value);





  const container = document.getElementById("graph");
console.log(container)
graphCtx.value = drawGraph(container, data.nodes, data.edges);



const graphe_svg = d3.select(graphEl.value);
 // Observer les changements de taille du conteneur
            const resizeObserver = new ResizeObserver(entries => {
                for (let entry of entries) {
                    const width = entry.contentRect.width;
                    const height = entry.contentRect.height;

                    console.log("Nouvelle taille du graphe :", width, height);

                    // Re-rendre le graphe D3 ici
                    updateGraphSize(width, height, graphCtx.value.simulation, graphCtx.value.svg);
                }
            });

            resizeObserver.observe(container);

  graphe_svg.on('click', (event) => {
                console.log("click");
                graphCtx.value.simulation.stop();

                const user = document.getElementById("user").value;

                // Récupère la transformation appliquée par le zoom
                const transform = d3.zoomTransform(graphCtx.value.svg.node());
                console.log(transform);

                // Coordonnées du clic dans le repère logique du graphe
                const [mouseX, mouseY] = transform.invert(d3.pointer(event));
                // Calculer distance par rapport à chaque nœud
                const clickedNode = data.nodes.find(d => {
                    const dx = d.x - mouseX;
                    const dy = d.y - mouseY;
                    return Math.sqrt(dx * dx + dy * dy) < 10; // rayon toléré
                });
                console.log("Clicked node:", clickedNode);
                if (clickedNode) {
                    console.log("Clicked node:", clickedNode);
                    var nodeId = clickedNode.id;
                }


                if (!nodeId) return
                if (!liste_node_click.includes(nodeId)) { // Si node jamais cliqué :
                    liste_node_click.push(nodeId) // ajouter dans liste

                    console.log("liste click :", liste_node_click);
                    console.log("afficher voisins !")
                    console.log("clic sur : ", nodeId);
                    console.log("parent dico : ", parent);

                    //var node = data.nodes.get(nodeId);

                    
                    const cb_predicates =  predicats.value.filter((p) => p.checked).map((p) => p.name);

                    /*  if (cb_predicates.length > 0) {
                        alert(`Cases cochées : ${cb_predicates.join(', ')}`);
                    } else {
                        alert("Aucune case n'est cochée.");
                    }*/


                   
                    const encodedNodeId = encodeURIComponent(nodeId);
                    fetch(`${API_URL}/api/pathETvoisins?start=${user.value}&end=${course.value}&voisin=${encodedNodeId}&choix=false`, { // Récuperer les voisins sortants de nodeId
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({ predicates: cb_predicates })
                    })
                        .then(res => res.json())
                        .then(data2 => {
                            // Exclure les doublons de nœuds
                            const existingNodeIds = new Set(data.nodes.map(n => n.id));
                            console.log("data nodes : ", data2.nodes);
                            console.log("data edges : ", data2.edges);
                            console.log("already existing nodes : ", existingNodeIds);
                            console.log("path et voisins de ", nodeId, " : ", data2);
                            const newNodes = data2.nodes.filter(n => !existingNodeIds.has(n.id));
                            console.log("new nodes not in data actu :", newNodes);

                            // Mise à jour dict parent
                            
                            for (const node of newNodes) {
                                console.log("new node:", node.id);
                                parent[node.id] = nodeId;
                              }

                            console.log("dico parent apres ajout enfant", parent);

                            // Exclure les doublons d'arêtes (selon from/to ou id si défini)
                            const existingEdgeKeys = new Set(data.edges.map(e => `${e.from}->${e.to}`));
                            const newEdges = data2.edges.filter(e => !existingEdgeKeys.has(`${e.from}->${e.to}`));
                            console.log("new edges not in data actu :", newEdges);

                            // Fusionner les données
                            newNodes.forEach(n => {
                                n.x = Math.random() * +600;
                                n.y = Math.random() * +600;
                            });
                            data.nodes =  [...data.nodes, ...newNodes]
                            data.edges= [...data.edges, ...newEdges]
                            


                            if (data2.nodes.length == 0) {
                                alert("Pas de voisins ! ");
                                liste_node_click.splice(liste_node_click.indexOf(nodeId), 1); // Retirer nodeId de la liste des nodes cliqués
                            } else {
                                console.log("liste click :", liste_node_click);

                                // Mettre à jour le graphe
                                console.log("data avant update:", data);
                                console.log("data['nodes']:", data["nodes"]);

                                updateGraph(data.nodes, data.edges, graphCtx.value);
                                fitToGraph(graphCtx.value.svg, graphCtx.value.zoom);
                            }

                        });

                } else { // Sinon, si node cliqué une seconde fois
                    console.log("liste click :", liste_node_click);
                    console.log("dico parents :", parent);
                    console.log("enfant : ", Object.keys(parent));
                    console.log("parent: ", Object.values(parent));

                    // Vérifier si ses noeuds voisins ont des noeuds sortants
                    var grandparent = 0;

                    for (const k of Object.keys(parent)) {
                        //console.log("key : " + k);
                        if (parent[k] == nodeId && Object.values(parent).includes(k)) {
                            grandparent = 1;
                        }
                    }

                    if (grandparent == 0) {


                        liste_node_click.splice(liste_node_click.indexOf(nodeId), 1); // Retirer noeud de la liste des nodes cliqué
                        const encodedNodeId = encodeURIComponent(nodeId);
                        fetch(`${API_URL}/api/voisins?voisin=${encodedNodeId}&choix=false`) // Récuperer ses voisins pour les retirer
                            .then(res => res.json())
                            .then(data2 => {
                                console.log("retirer voisins de ", nodeId, " !");

                                // Récupérer les ids des voisins à retirer
                                const idsToRemove = new Set(data2.nodes.map(n => n.id));
                                const edgesToRemove = new Set(data2.edges.map(e => `${e.from}->${e.to}`));

                                // Construire un set des ids du chemin initial (path)
                                var pathNodeIds = new Set(path.nodes.map(n => n.id));
                                var pathEdge = new Set(path.edges.map(e => `${e.from}->${e.to}`));

                                if (path2_en_cours) { // Si on a ajouté au chemin initial d'autres chemins (mode ajout ou échange), prendre en consideration le total des chemins
                                    pathNodeIds = new Set(path2.nodes.map(n => n.id));
                                    pathEdge = new Set(path2.edges.map(e => `${e.from}->${e.to}`));
                                }

                                console.log("path 2 en cours : ", path2_en_cours);
                                console.log("path nodes : ", pathNodeIds);
                                console.log("path edges : ", pathEdge);
                                console.log("voisins : ", data2);
                                console.log("nodes à enlever : ", idsToRemove);

                                // Ne retirer que les noeuds qui sont dans idsToRemove mais PAS dans pathNodeIds
                                data.nodes = data.nodes.filter(n => {
                                    // Retirer uniquement si le noeud est un voisin ET pas dans le chemin initial
                                    var p = 0;
                                    for (const k of Object.keys(parent)) {
                                        //console.log("key : " + k);
                                        if (parent[k] == n.id) {
                                            p = 1;
                                        }
                                    }
                                    if (idsToRemove.has(n.id) && !pathNodeIds.has(n.id) && p == 0) {
                                        parent[n.id] = null; // mettre à jour dict parent
                                        if (n.id in liste_node_click) {
                                            liste_node_click.splice(liste_node_click.indexOf(n.id), 1);
                                        }
                                        return false; // retirer
                                    }
                                    return true; // garder
                                });
                                const validNodeIds = new Set(data.nodes.map(n => n.id));

                                data.edges = data.edges.filter(e =>
                                    validNodeIds.has(e.from) && validNodeIds.has(e.to) && !(edgesToRemove.has(`${e.from}->${e.to}`) && !pathEdge.has(`${e.from}->${e.to}`))
                                );


                                console.log("data finale : ", data);

                                //si un element est dans liste node click mais n'est pas parent, le retirer : 
                                var p = 0
                                for (const n of liste_node_click) {
                                    for (const k of Object.keys(parent)) {

                                        if (parent[k] == n) {
                                            p = 1;
                                        }
                                    }
                                    console.log("node check : " + n, " p= " + p);
                                    if (p == 0) {
                                    liste_node_click.splice(liste_node_click.indexOf(n), 1); ///////////////////////////////////////////////////retirer aussi les edges ???????????????????????????????????????????????????????????????!!!!!!!!!!!!!!! A FAIRE
                                }
                                }
                                

                                // Mettre à jour le graphe
                                updateGraph(
                                    data.nodes,
                                    data.edges,
                                    graphCtx.value
                                );



                            });
                    } else {
                        alert("Clique d'abord sur les nodes enfants de celui-là !");

                    }
                }
 }) 
  
})

</script>

<template>
  <div id="main-layout">
    <div id="nav-bar">
      <div><h1>ExplainGraph</h1></div>
      <div style="display: flex; flex: 1; overflow: hidden; padding-left: 20px;"><img src="../assets/liris.png"
                    alt="LIRIS" height="50"></div>
      <div class="nav-links">
        <a href="http://localhost:8000/page3.html">Home</a>
        <a href="https://liris.cnrs.fr/equipe/tweak">About</a>
        <a href="http://localhost:8000">Settings</a>
      </div>
    </div>

    <div id="content-area" style="display: flex; flex: 1; overflow: hidden;">
      <div id="left-panel" style="flex: 0 0 300px; padding: 20px; overflow-y: auto; border-right: 1px solid #ccc;">
        <h3>Control panel</h3>
        <p>Enter a User id to generate a recommendation and its explanation.</p>

        <label for="user">User</label>
        <input type="text" id="user" v-model="user" placeholder="user_xx" />

        <button class="button" @click="loadPath"
             title="Click here to generate a recommendation and its explanation">Show Path</button>
        <button class="button" @click="resetPredicats"
              title="Click here to delete the explanation">Reset</button>

        
      </div>

      <div id="center-panel" style="flex: 1; padding: 20px; overflow-y: auto;">
        <div id="affichage-cours"></div>
        <h3>Path From A Weighted Graph</h3>

        <div class="graph-controls">
          <button class="button" @click="resetView"
                title="Click here to recenter the graph and adjust the zoom">Recenter The Graph</button>
          <button class="button" @click="resetPath"
                title="Click here to come back to the initial path explanation">Reset Path</button>
          <input type="text" v-model="searchNode" placeholder="course_xx, user_xx,..." />
          <button class="button" @click="chercherNode"
                title="Enter a node's name and click here to show its position in the graph">Find A Node</button>
        </div>

        <div>Click on a node to extend the graph by showing its neighbors. You can also select below the graph what type of neighbors you want to display.</div>

        <div id="graphs-container">
          <div class="g" ref="graphEl" id = "graph"></div>
          <fieldset id="cochePredicats">
            <legend>Choose the predicates you want to display (Coming out of the clicked node)</legend>
             
    <!-- Container pour les checkboxes -->
    <div id="cochePredicats">
      <div v-for="(predicat, index) in predicats" :key="index">
        <label>
          <input
            type="checkbox"
            class="myCheckbox"
            :id="predicat.name"
            :name="predicat.name"
            v-model="predicat.checked"
          />
          {{ predicat.name }}
        </label>
      </div>
    </div>

  
          </fieldset>
        </div>
          <!-- Bouton "Uncheck All" -->
    <div class="button" id="uncheckAllBtn" @click="uncheckAll">
      Uncheck All
    </div>

    <div id="tooltip" style="
    position: absolute;
    background-color: white;
    border: 1px solid #ccc;
    padding: 6px 10px;
    font-size: 12px;
    pointer-events: none;
    display: none;
    z-index: 1000;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    border-radius: 4px;">
    </div>

        <div class="graph-controls" id="graph-controls2">
          <h3 style="display: block; width: 100%;">Choose how to interact with the other paths : </h3>
          <button class="button" @click="ajouterGraph"
                title="Add a path to the main one by clicking on it">Add The Path</button>
          <button class="button" @click="echangerGraph"
                title="Click on a path to display it instead of the main path">Swap The Path</button>
          <h3>{{ mode }}</h3>
          <span>{{ indexPathAffiche + 1 }} / {{ dataPaths.length }}</span>
        </div>

        <h3 id="titre2"></h3>
        <div id="g_petit-container">
          
            <button class="predicat" @click="prevPath" :disabled="indexPathAffiche===0"><</button>
            
                    

          <!-- Affichage des paths -->
          <div v-for="(p,i) in dataPaths" :key="i" v-show="i===indexPathAffiche" class="div_chemin_info_button">
            <div class="g_petit" :id="'g'+i"></div>
            <div>S_rw = {{ p.S_rw }}, S_jac = {{ p.S_jac }} → {{ p.S_final }}</div>
            <div>Longueur = {{ p.longueur }}</div>
            <div>Pattern : {{ p.pattern }}</div>

            <button :style="{backgroundColor : p.repondu ? '#9EBC8A':''}" class = "button" @click="p.showQuestions = !p.showQuestions">
              {{ p.showQuestions ? "Hide" : "Answer" }}
            </button>

            <div v-if="p.showQuestions" class="divQuestions">
              <form>
                <div v-for="(qtGroup, groupName) in liste_question_possible" :key="groupName">
                  <div>{{ groupName }}</div>
                  <div v-for="(qt, qIndex) in qtGroup" :key="qIndex">
                    <strong >{{ qt }}</strong><!--:style="{ color: !p.answers[qt] ? 'red' : '' }"-->
                    <div>
                    <select v-model="p.answers[qt]">
                      <option disabled value="">-- Select an answer --</option>
                      <option v-for="opt in liste_answer_possible" :key="opt" :value="opt">
                        {{ opt }}
                      </option>
                    </select>
                    </div>
                  </div>
                </div>
              </form>
              <button class="button" @click.prevent="validatePath(p)">Validate</button>
            </div>
            
          </div>
          <button class="predicat" @click="nextPath" :disabled="indexPathAffiche===dataPaths.length-1">></button>

         
  </div>
   <!-- Questions générales -->
          <hr />
          <h3>⬇️ General Feedback ⬇️</h3>
          <div v-for="(options, question, idx) in questions_reponses_generales" :key="idx" class="divQuestions">
            <label>{{ question }}</label>
            <div v-if="options.length > 0" >
            <select v-model="reponseUserStudy.general_feedback[question]">
              <option disabled value="">-- Select an answer --</option>
              <option v-for="opt in options" :key="opt" :value="opt">{{ opt }}</option>
            </select>
            </div>
          </div>

          <!-- Bouton global -->
          <button class="button" @click="saveAll">Save</button>
        </div>

      <div id="right-panel">
        <h3>Explanation</h3>
        <p id="Explication">{{ explanation }}</p>

        <h4>Legend</h4>
        <ul style="list-style: none; padding-left: 0;">
          <li v-for="(color, type) in legend" :key="type">
            <span :style="{ backgroundColor: color }" class="legend-color"></span> {{ type }}
          </li>
          <li>
          <div style="display: flex; align-items: center; margin-bottom: 8px;">
                            <div id="legendLiteral">
                                Literal
                            </div>
                            <span>Literal</span>
                        </div>
          </li>
        </ul>

        <h4>Top 5 Semantic Attributes</h4>
        <p>This bar chart shows what percentage of the user's high interest courses shares the same semantic
                    attributes as the recommended course. This chart only shows the top 5, non-zero percentages.</p>
        <div id="messageTop5">{{ top5Message }}</div>
        <canvas id="top5chart" width="260" height="200"></canvas>
      </div>
    </div>
  </div>
</template>

<style>
        /* ----------- RESET & BASE ----------- */
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Segoe UI', sans-serif;
            background-color: #f7f9fc;
            color: #333;
            height: 100%;
            overflow: hidden;
            font-size: 15px;
        }

        /* ----------- NAVIGATION ----------- */
        #nav-bar {
          position: fixed;
          top :0;
          left :0;
          width : 100%;
          z-index: 100;
          
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 14px 28px;
            background-color: #fff;
            border-bottom: 1px solid #e5e5e5;
            font-size: 18px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
        }

        #nav-bar a {
            text-decoration: none;
            color: #333;
            font-weight: 500;
            transition: color 0.3s;
        }

        #nav-bar a:hover {
            color: #2f80ed;
        }

        /* ----------- LAYOUT PRINCIPAL ----------- */
        #content-area {
            display: flex;
            padding-top: 60px;
            height: calc(100vh + 60 vh);
        }
        #left-panel, #right-panel {
  height: calc(100vh - 60px); /* tient compte du header */
  overflow-y: auto;
}

        /* ----------- PANNEAU DE CONTRÔLE (GAUCHE) ----------- */
        #left-panel {
            flex: 0 0 280px;
            background-color: #ffffff;
            border-right: 1px solid #eee;
            padding: 24px;
            overflow-y: auto;
            box-shadow: inset -1px 0 0 #eee;
            text-align: left; /* ← aussi aligné à gauche */
        }

        #left-panel h3 {
            font-size: 18px;
            margin-bottom: 16px;
            color: #444;
        }

        #left-panel label {
            display: block;
            margin-top: 16px;
            font-weight: 600;
            color: #555;
        }

        #left-panel input[type="text"],
        #left-panel select {
            width: 100%;
            padding: 10px 12px;
            margin-top: 6px;
            border: 1px solid #ccc;
            border-radius: 8px;
            background-color: #fdfdfd;
            transition: border 0.3s;
        }

        #left-panel input:focus,
        #left-panel select:focus {
            border-color: #A0C878;
            outline: none;
        }

        /* ----------- BOUTONS ----------- */
        .button {
            background-color: #749BC2;
            color: white;
            border: none;
            border-radius: 8px;
            padding: 10px 14px;
            width: 100%;
            margin-top: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: background-color 0.3s, box-shadow 0.2s;
        }

        .button:hover {
            background-color: #4682A9;
            box-shadow: 0 2px 8px rgba(47, 128, 237, 0.3);
        }

        /* ----------- DROP ZONES POUR PRÉDICATS ----------- */
       
        #listPredicats {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 10px;
        }

        .predicat {
            padding: 6px 10px;
            background-color: #FFFBDE;
            color: #333;
            font-weight: bold;
            border-radius: 6px;
            border: 2px solid #ada56a;
            cursor: grab;
            font-size: 14px;
            user-select: none;
            width :10%;
        }

        .predicat:hover {
            background-color: #ada56a;
        }

        /* ----------- CENTRE : GRAPHE ----------- */
        #cochePredicats {
          text-align: left !important;
        }
        .divQuestions {
            width: 100%;
            margin-top: 20px;
            text-align: left !important;
        }
      


        .divQuestions form>div {
            margin-bottom: 20px;
            /* espace entre les questions */
        }
        .divQuestions label {
  display: block; /* pour que chaque question et réponse prennent toute la largeur */
        }

        .mySelect {
            padding: 8px 12px;
            border: 1px solid #ccc;
            border-radius: 6px;
            background-color: #fff;
            font-size: 14px;
            color: #333;
            width: 100%;
            max-width: 400px;
            margin-bottom: 12px;
            appearance: none;
            /* enlève le style natif du navigateur */
            background-image: url("data:image/svg+xml;charset=UTF-8,%3Csvg viewBox='0 0 140 140' xmlns='http://www.w3.org/2000/svg'%3E%3Cpolygon points='70,100 100,40 40,40' fill='%23666'%3E%3C/polygon%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 10px center;
            background-size: 12px;
        }

        .mySelect:focus {
            border-color: #91C8E4;
            outline: none;
            box-shadow: 0 0 3px rgba(145, 200, 228, 0.8);
        }


        .radioOption {
            display: flex;
            align-items: center;
            margin: 4px 0;
            gap: 8px;
        }

        .graph-controls {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-bottom: 20px;
            align-items: center;
        }

        .graph-controls .button {
            flex: 0 0 auto;
            width: auto;
            padding: 10px 16px;
        }

        .graph-controls input[type="text"] {
            flex: 1;
            min-width: 180px;
            padding: 10px 12px;
            border: 1px solid #ccc;
            border-radius: 8px;
        }

        
        #center-panel {
  height: calc(100vh - 60px);       /* ou la hauteur que tu veux */
  overflow-y: auto;   /* active le scroll vertical */
  //overflow-x: hidden; /* empêche le scroll horizontal si besoin */
  background-color: #f9f9fb;
  flex: 1;
  text-align: left;
  padding: 24px;
  display: flex;
            flex-direction: column;  /* si tu as un header et un footer */
        margin : 0;

}


        /* #g_petit-container {
            display: flex;
            flex-wrap: wrap;
            padding : 24px;
            gap: 20px;
            margin-top: 20px;
        } */

        #g_petit-container {
    display: flex;
    flex-direction: row;   /* ← les enfants côte à côte */
    //flex-wrap: wrap;       /* permet le retour à la ligne si trop large */
    align-items: center; 
    justify-content: center;
    gap: 40px;
    padding: 24px;
    margin-top: 20px;
}

/* Pour chaque bouton et le div interne */
#g_petit-container > .predicat {
    flex: 1 1 auto;          /* peut grandir ou rétrécir */
    min-width: 5px;        /* largeur minimale pour ne pas disparaître */
    max-width: 300px;        /* largeur maximale */
}


        .div_chemin_info_button {
            width: 70%;
             
        }

        #div_graphes_tous {
            width: 75%;
        }

        .g {
            width: 100%;
            height: 600px;
            border: 3px solid #91C8E4;
            background-color: #fff;
            border-radius: 20px;
            box-shadow: 0 2px 10px #FAF6E9;
        }

        .g_petit {
            width: 100%;
            height: 200px;

            border: 3px solid #91C8E4;
            background-color: #f1f0e9;
            border-radius: 16px;
            box-shadow: 0 1px 6px #FAF6E9;
        }

        /* ----------- DROITE - EXPLICATION ----------- */
        #right-panel {
            flex: 0 0 300px;
            background-color: #ffffff;
            border-left: 1px solid #eee;
            padding: 24px;
            overflow-y: auto;
            box-shadow: inset 1px 0 0 #eee;
            text-align: left; /* ← aussi aligné à gauche */
            
        }

        #right-panel h3 {
            font-size: 18px;
            margin-bottom: 10px;
            color: #444;
            align-items: flex-start;   
            justify-content: flex-start;
            padding-left: 0;
        }

        #right-panel p {
            font-size: 14px;
            margin-bottom: 24px;
            line-height: 1.6;
            align-items: flex-start;   
            justify-content: flex-start;
            padding-left: 0;
        }

        #right-panel h4 {
            font-size: 16px;
            margin-top: 20px;
            margin-bottom: 10px;
            color: #555;
            align-items: flex-start;   
            justify-content: flex-start;
            padding-left: 0;
        }

        #right-panel ul {
            list-style: none;
            padding-left: 0;
        }

        #right-panel li {
            display: flex;
            align-items: center;
            margin-bottom: 10px;
            font-size: 14px;
        }

        .legend-color {
            display: inline-block;
            width: 14px;
            height: 14px;
            margin-right: 8px;
            border-radius: 50%;
        }

        .legend-color.blue {
            background-color: #3b82f6;
        }

        .legend-color.gray {
            background-color: #6c757d;
        }

        #legendLiteral {
            background-color: #b6e69b;
            border: 1px solid #88c977;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 14px;
            font-family: sans-serif;
            margin-right: 8px;
            color: #333;
            box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.1);
        }

        /* ----------- RESPONSIVE ----------- */
        @media (max-width: 1024px) {
            #content-area {
                flex-direction: column;
            }

            #left-panel,
            #right-panel {
                flex: none;
                width: 100%;
                border: none;
            }

            .g {
                height: 400px;
            }
        }


        #graph {
  width: 100%;
  height: 400px; /* ou ce que tu veux */
  border: 1px solid #ccc;
}

    </style>

// === Globals ===
// État global minimal pour piloter l'interface et les calculs
var index_path_affiché = 0; // index du petit chemin affiché
let liste_node_click = []; // ids des nodes dont on a déjà affiché le voisinage
let top5ChartInstance = null; // instance Chart.js (top 5)
let reponse_user_study = {
    general_feedback: {},
    path_feedback: {}
}; // réponses du user study (général et par chemin)
var choix = "false"; // "false" => pondération par défaut, "true" => pondération selon prédicats choisis
var path = { nodes: [], edges: [] }; // chemin principal
var path2 = { nodes: [], edges: [] }; // variante du chemin (ajout/échange)
var data = { nodes: [], edges: [] }; // graphe actuellement affiché
var course = ""; // cours recommandé
let user = null; // identifiant utilisateur courant
let participant_info = {}; // infos saisies dans la 1ère interface
const liste_answer_possible = ['strongly agree', 'agree', 'neutre', 'disagree', 'strongly disagree']; // options standard des questions

// Questions générales sur l’interface d’explication
const questions_reponses_generales = {
    "Do you think explanations, either graph, diagram or text-based, are useful ?": liste_answer_possible,
    "Which explanation format do you prefer ?": ["graph-based", "text-based", "bar chart"],
    "Adding context to the explanations (neighborhood of the path’s nodes) is useful": liste_answer_possible,
    "Choosing which predicates to display when exploring the path’s neighborhood is useful.": liste_answer_possible,
    'Based on the share of semantic attributes between the recommended course and your interest in these semantic attributes (in the top 5 chart):': [],
    "This is a good recommandation.": liste_answer_possible,
    "I will follow this course.": liste_answer_possible,
    "I can determine how well I will like this course.": liste_answer_possible
};

// Questions évaluant chaque chemin d’explication
const liste_question_possible = [
    'Without adding paths or modifying the graph, the explanation path gives me enough information on why this course was recommended to me.',
    'This explanation path has irrelevant details, which make it overwhelming/difficult to understand.',
    'The topics mentioned in this explanation path are familiar to me.',
    'This explanation path seems aligned with my personal interests.'
];

var path2_en_cours = false; // true quand on modifie le chemin initial (ajout/échange)
var mode = "modeAjoutGraph"; // mode d'interaction avec les petits chemins: "modeAjoutGraph" ou "modeEchangeGraph"

// Variables supplémentaires qui étaient implicites
let allPaths = [];
let parent = {}; // map enfant -> parent (utile pour nettoyer les voisins)

// -----------------FONCTIONS SIMPLES---------------//

// Palette simple par groupe
function getNodeColor(group) {
    return group === 0 ? "orange" :
        group === 1 ? "rgb(245, 221, 6)" :
            group === 2 ? "rgb(236, 112, 90)" :
                group === 3 ? "rgb(67, 143, 206)" : "#bce98f";
}

// Recherche d’un node par label dans le chemin affiché et focus dessus
function chercherNode() {
    const node = document.getElementById("node").value;
    const currentPath = allPaths[index_path_affiché];
    data = {
        nodes: [...currentPath.nodes],
        edges: [...currentPath.edges]
    };
    for (const n of data.nodes) {
        if (n.label == node) {
            const graph = window.graphPrincipal;
            const width = +graph.svg.attr("width");
            const height = +graph.svg.attr("height");
            focusOnNode(graph, n.id, width, height);
            return;
        }
    }
    alert("Node non trouvé");
    return;
}

// Ajuste le SVG + redémarre la simulation pour un resize propre
function updateGraphSize(width, height, simulation, svg) {
    svg
        .attr("width", width)
        .attr("height", height);

    simulation.force("center", d3.forceCenter(width / 2, height / 2).strength(0.01));
    simulation.alphaDecay(0.1);
    simulation.alpha(1).restart();
}

// Cadre la vue pour englober la zone occupée par le graphe
function fitToGraph(svg, zoomfunction) {
    const bounds = svg.select("g.zoom-group").node().getBBox();
    const fullWidth = +svg.attr("width");
    const fullHeight = +svg.attr("height");

    const width = bounds.width;
    const height = bounds.height;
    const midX = bounds.x + width / 2;
    const midY = bounds.y + height / 2;

    const scale = 0.85 / Math.max(width / fullWidth, height / fullHeight);
    const translate = [
        fullWidth / 2 - scale * midX,
        fullHeight / 2 - scale * midY,
    ];

    svg
        .transition()
        .duration(750)
        .call(
            zoomfunction.transform,
            d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
        );
}

// Focus doux sur un node donné (stroke + zoom centré)
function focusOnNode(graph, nodeId, width, height) {
    const node = graph.simulation.nodes().find(n => n.id === nodeId);
    if (!node) return;

    graph.nodeGroup.selectAll("circle")
        .attr("stroke", d => d.id === nodeId ? "black" : null)
        .attr("stroke-width", d => d.id === nodeId ? 4 : null)
        .attr("fill", d => d.id === nodeId ? "pink" : (getNodeColor(d.group)));

    const newZoom = d3.zoomIdentity
        .translate(width / 2, height / 2)
        .scale(1.5)
        .translate(-node.x, -node.y);

    graph.svg.transition().duration(750)
        .call(graph.zoom.transform, newZoom);
}


// Récupère les réponses aux questions générales (libellés + valeurs)
function collectGeneralFeedback() {
    const feedback = {};
    // Chaque question est rendue dans un .question-block avec une étiquette .question-label
    const blocks = document.querySelectorAll("#questionsGenerales .question-block");
    blocks.forEach(block => {
        const labelEl = block.querySelector(".question-label");
        const label = (labelEl ? labelEl.textContent.trim() : (block.getAttribute("data-label") || "")).replace(/\s+/g, " ").trim();
        if (!label) return;

        let value = "";
        const checkedRadio = block.querySelector('input[type="radio"]:checked');
        const select = block.querySelector("select");
        const textarea = block.querySelector("textarea");

        if (checkedRadio) {
            value = checkedRadio.value;
        } else if (select) {
            value = select.value;
        } else if (textarea) {
            value = textarea.value.trim();
        } else {
            value = "";
        }
        feedback[label] = value;
    });
    return feedback;
}

// ---------------- SURVEY BUILDERS (Likert, Yes/No, Text) ----------------

// Crée une ligne de radios Likert 1-5
function buildLikertQuestion(container, name, questionText, required = true) {
    const block = document.createElement("div");
    block.className = "question-block likert-group";
    block.setAttribute("data-required", required ? "true" : "false");
    const label = document.createElement("label");
    label.className = "question-label";
    label.textContent = questionText + " (1–5)";
    block.appendChild(label);

    const scale = document.createElement("div");
    scale.className = "likert-scale";
    // En-têtes (1..5)
    const header = document.createElement("div");
    header.className = "likert-scale-header";
    ["1", "2", "3", "4", "5"].forEach(h => {
        const span = document.createElement("span");
        span.textContent = h;
        header.appendChild(span);
    });
    block.appendChild(header);

    // Radios
    const radios = document.createElement("div");
    radios.className = "likert-scale-options";
    for (let i = 1; i <= 5; i++) {
        const id = `${name}_${i}`;
        const wrapper = document.createElement("label");
        wrapper.className = "likert-option";
        const input = document.createElement("input");
        input.type = "radio";
        input.name = name;
        input.id = id;
        input.value = String(i);
        input.required = !!required;
        const dot = document.createElement("span");
        dot.className = "radio-dot";
        wrapper.appendChild(input);
        wrapper.appendChild(dot);
        radios.appendChild(wrapper);
    }
    block.appendChild(radios);

    const legend = document.createElement("div");
    legend.className = "likert-legend";
    legend.innerHTML = "<span>1 = Strongly Disagree</span><span>5 = Strongly Agree</span>";
    block.appendChild(legend);

    container.appendChild(block);
}

function buildYesNoQuestion(container, name, questionText, required = true) {
    const block = document.createElement("div");
    block.className = "question-block yesno-group";
    block.setAttribute("data-required", required ? "true" : "false");
    const label = document.createElement("label");
    label.className = "question-label";
    label.textContent = questionText;
    block.appendChild(label);
    const group = document.createElement("div");
    group.className = "radio-row";
    ["Yes", "No"].forEach(val => {
        const id = `${name}_${val.toLowerCase()}`;
        const wrapper = document.createElement("label");
        wrapper.className = "radio-pill";
        const input = document.createElement("input");
        input.type = "radio";
        input.name = name;
        input.id = id;
        input.value = val;
        input.required = !!required;
        const txt = document.createElement("span");
        txt.textContent = val;
        wrapper.appendChild(input);
        wrapper.appendChild(txt);
        group.appendChild(wrapper);
    });
    block.appendChild(group);
    container.appendChild(block);
}

function buildRadioQuestion(container, name, questionText, options, required = false) {
    const block = document.createElement("div");
    block.className = "question-block radio-group-custom";
    block.setAttribute("data-required", required ? "true" : "false");
    const label = document.createElement("label");
    label.className = "question-label";
    label.textContent = questionText;
    block.appendChild(label);
    const group = document.createElement("div");
    group.className = "radio-column";
    options.forEach((opt, i) => {
        const id = `${name}_${i}`;
        const wrapper = document.createElement("label");
        wrapper.className = "radio-pill wide";
        const input = document.createElement("input");
        input.type = "radio";
        input.name = name;
        input.id = id;
        input.value = opt;
        input.required = !!required;
        const txt = document.createElement("span");
        txt.textContent = opt;
        wrapper.appendChild(input);
        wrapper.appendChild(txt);
        group.appendChild(wrapper);
    });
    block.appendChild(group);
    container.appendChild(block);
}

function buildTextareaQuestion(container, name, questionText, placeholder = "", required = false) {
    const block = document.createElement("div");
    block.className = "question-block text-block";
    block.setAttribute("data-required", required ? "true" : "false");
    const label = document.createElement("label");
    label.className = "question-label";
    label.textContent = questionText;
    block.appendChild(label);
    const ta = document.createElement("textarea");
    ta.name = name;
    ta.placeholder = placeholder || "Your answer...";
    ta.rows = 4;
    block.appendChild(ta);
    container.appendChild(block);
}

// Construit toutes les sections du questionnaire spécifié par l'utilisateur
function buildSurveySections(container) {
    // 1) Recommendation Relevance
    const sec1 = document.createElement("div");
    sec1.className = "survey-section";
    sec1.innerHTML = "<h4>Recommendation Relevance (Likert 1–5)</h4>";
    container.appendChild(sec1);
    buildLikertQuestion(sec1, "rec_relevance_learning_needs", "The recommended course is relevant to my learning needs.", true);
    buildLikertQuestion(sec1, "rec_relevance_skill_match", "The recommended course matches my skill level.", true);
    buildLikertQuestion(sec1, "rec_relevance_enroll_consider", "I would consider enrolling in this course based on this recommendation.", true);
    buildLikertQuestion(sec1, "rec_relevance_useful_overall", "Overall, I find this recommendation useful.", true);

    // 2) Explanation Clarity and Usefulness
    const sec2 = document.createElement("div");
    sec2.className = "survey-section";
    sec2.innerHTML = "<h4>Explanation Clarity and Usefulness (Likert 1–5)</h4>";
    container.appendChild(sec2);
    buildLikertQuestion(sec2, "exp_clarity_why_recommended", "The explanation clearly shows why this course was recommended.", true);
    buildLikertQuestion(sec2, "exp_clarity_relations_easy", "The relationships presented in the path/explanation are easy to understand.", true);
    buildLikertQuestion(sec2, "exp_clarity_multihop_helpful", "The multi-hop structure of the explanation is helpful to understand the reasoning.", true);
    buildLikertQuestion(sec2, "exp_clarity_evaluate_goals", "The explanation helps me evaluate whether the course meets my learning goals.", true);
    buildLikertQuestion(sec2, "exp_clarity_detail_appropriate", "The level of detail in the explanation is appropriate.", true);

    // 3) Trust and Transparency
    const sec3 = document.createElement("div");
    sec3.className = "survey-section";
    sec3.innerHTML = "<h4>Trust and Transparency</h4>";
    container.appendChild(sec3);
    buildLikertQuestion(sec3, "trust_increase", "The explanation increases my trust in the recommendation system.", true);
    buildLikertQuestion(sec3, "trust_reliable_info", "I believe the system uses relevant and reliable information to recommend the course.", true);
    buildYesNoQuestion(sec3, "trust_less_without_expl", "I would have less trust in the recommendation without the explanation.", true);

    // 4) Usability Measures (Optional — Short SUS)
    const sec4 = document.createElement("div");
    sec4.className = "survey-section";
    sec4.innerHTML = "<h4>Usability Measures (Optional — Short SUS)</h4>";
    container.appendChild(sec4);
    buildRadioQuestion(sec4, "style_preference", "Among the following explanation styles, which one do you find the most useful to understand why a recommendation was made?", [
        "Collaborative filtering: “Learners with similar interests also enrolled in this course.”",
        "Popularity-based: “This course is one of the most popular in your area of interest.”",
        "Path-based : (our proposed approach)"
    ], false);
    buildLikertQuestion(sec4, "usability_format_easy", "I find the presentation format (recommendation + path) easy to use.", false);
    buildLikertQuestion(sec4, "usability_satisfaction", "Overall, I am satisfied with the experience.", false);

    // 5) Section 7 — Open-ended Questions (Qualitative)
    const sec5 = document.createElement("div");
    sec5.className = "survey-section";
    sec5.innerHTML = "<h4>Section 7 — Open-ended Questions (Qualitative)</h4>";
    container.appendChild(sec5);
    buildTextareaQuestion(sec5, "open_helped_most", "What helped you the most in understanding the recommendation? (free text)", "", false);
    buildTextareaQuestion(sec5, "open_confusing", "What was confusing or not helpful? (free text)", "", false);
    buildTextareaQuestion(sec5, "open_improve", "How could we improve the explanation presentation? (free text)", "", false);
    buildTextareaQuestion(sec5, "open_other_comments", "Any other comments about the recommendation or explanation? (free text)", "", false);
}

function drawGraph(container, nodesData, edgesData) {
    if (!container) {
        console.error("Élément #graph-container introuvable.");
        return;
    }
    container.innerHTML = "";

    var width = container.clientWidth;
    var height = container.clientHeight;
    // Cas où le conteneur est caché (calculer une taille plausible)
    if (container.parentElement && container.parentElement.style.display == "none") {
        const oldDisplay = container.parentElement.style.display;
        container.parentElement.style.display = "block";
        void container.parentElement.offsetWidth;
        width = container.clientWidth || 600;
        height = container.clientHeight || 400;
        container.parentElement.style.display = oldDisplay;
    }

    const svg = d3.select(container)
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    // Groupes pour liens/nodes/labels
    const zoomGroup = svg.append("g").attr("class", "zoom-group");
    const linkGroup = zoomGroup.append("g").attr("class", "links");
    const nodeGroup = zoomGroup.append("g").attr("class", "nodes");
    const labelGroup = zoomGroup.append("g").attr("class", "labels");
    const edgeLabelGroup = zoomGroup.append("g").attr("class", "edge-labels");

    // Flèches pour les arêtes dirigées
    svg.append("defs").append("marker")
        .attr("id", "arrow")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 15)
        .attr("refY", 0)
        .attr("markerWidth", 15)
        .attr("markerHeight", 15)
        .attr("orient", "auto")
        .attr("markerUnits", "userSpaceOnUse")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "currentColor");

    // Autoriser les interactions souris/touch sur tous les calques utiles
    d3.select("svg").style("pointer-events", "all");
    d3.select("g.zoom-group").style("pointer-events", "all");
    d3.selectAll(".nodes circle").style("pointer-events", "all");

    // Zoom panoramique
    const zoom = d3.zoom()
        .scaleExtent([0.1, 5])
        .on("zoom", (event) => {
            zoomGroup.attr("transform", event.transform);
        });

    svg.call(zoom);

    // Simulation forces (longueurs de liens + répulsion + centrage)
    let simulation = d3.forceSimulation()
        .force("link", d3.forceLink().id(d => d.id).distance(200))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(+svg.attr("width") / 2, +svg.attr("height") / 2).strength(0.01))
        .alphaDecay(0.1);

    updateGraph(nodesData, edgesData, svg, linkGroup, nodeGroup, labelGroup, edgeLabelGroup, simulation, zoomGroup);
    return { svg, linkGroup, nodeGroup, labelGroup, edgeLabelGroup, simulation, zoomGroup, zoom };
}

// Mise à jour incrémentale du graphe (data join + tick handler)
function updateGraph(nodesData, edgesData, svg, linkGroup, nodeGroup, labelGroup, edgeLabelGroup, simulation, zoomGroup) {
    // Adapter les clés source/target pour d3.forceLink
    const edgesD3 = edgesData.map(e => ({
        ...e,
        source: e.from,
        target: e.to
    }));

    // Position initiale aléatoire si absente (évite tout superposer à 0,0)
    nodesData.forEach(n => {
        if (n.x == null) n.x = Math.random() * +svg.attr("width");
        if (n.y == null) n.y = Math.random() * +svg.attr("height");
    });

    simulation.nodes(nodesData);
    simulation.force("link").links(edgesD3);
    simulation.alpha(1).restart();

    // --- Liens courbes (quadratiques) ---
    const linkSelection = linkGroup.selectAll("path")
        .data(edgesD3, d => d.id || (d.source.id + "-" + d.target.id));

    linkSelection.exit().remove();

    const linkEnter = linkSelection.enter()
        .append("path")
        .attr("fill", "none")
        .attr("stroke-width", 1.5)
        .attr("stroke", d => {
            if (typeof d.source === "object") {
                return getNodeColor(d.source.group);
            }
            return "#aaa";
        })
        .style("color", d => {
            if (typeof d.source === "object") return getNodeColor(d.source.group);
            return "#aaa";
        })
        .attr("marker-end", "url(#arrow)");

    const linkElements = linkEnter.merge(linkSelection)
        .attr("stroke", d => (typeof d.source === "object" ? getNodeColor(d.source.group) : "#aaa"))
        .style("color", d => (typeof d.source === "object" ? getNodeColor(d.source.group) : "#aaa"))
        .attr("marker-end", "url(#arrow)");

    // --- Nodes : cercle par défaut ou rectangle étiqueté si label===id ---
    const nodeSelection = nodeGroup.selectAll(".node")
        .data(nodesData, d => d.id);

    nodeSelection.exit().remove();

    const attrs = {
        onNodeHover: function (_value) {
            // hook pour éventuels callbacks
        }
    };
    const tooltip = d3.select("#tooltip");

    const nodeEnter = nodeSelection.enter()
        .append(d => {
            if (d.label === d.id) {
                // Représentation "boîte + texte" pour les nodes self-labellisés
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

                const bbox = text.node().getBBox();

                rect
                    .attr("x", bbox.x - 6)
                    .attr("y", bbox.y - 4)
                    .attr("width", bbox.width + 12)
                    .attr("height", bbox.height + 8)
                    .attr("fill", getNodeColor(d.group));

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
            // survol: mise en évidence + tooltip si title est présent
            if (d.label === d.id) {
                d3.select(event.currentTarget).select('rect')
                    .attr("stroke", "black")
                    .attr("stroke-width", 3);
            } else {
                d3.select(event.currentTarget)
                    .attr("stroke", "black")
                    .attr("stroke-width", 3);
            }
            const value = d.title ?? '';
            attrs.onNodeHover?.(d.title ?? '');
            if (value !== '') {
                tooltip
                    .style("display", "block")
                    .html(value)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY + 10) + "px");
            }

        })
        .on("mouseout", (event, d) => {
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

    // --- Labels des nodes (pour les cercles uniquement) ---
    const labelSelection = labelGroup.selectAll("text")
        .data(nodesData, d => d.id);

    labelSelection.exit().remove();

    const labelEnter = labelSelection.enter()
        .append("text")
        .text(d => {
            if (d.label !== d.id) return d.label;
        })
        .attr("font-size", "10px")
        .attr("text-anchor", "middle")
        .attr("dy", 15);

    const labelElements = labelEnter.merge(labelSelection);

    // --- Labels des arêtes ---
    const edgeLabelSelection = edgeLabelGroup.selectAll("text")
        .data(edgesD3, d => d.id || (d.source.id + "-" + d.target.id));

    edgeLabelSelection.exit().remove();

    const edgeLabelEnter = edgeLabelSelection.enter()
        .append("text")
        .attr("font-size", "9px")
        .attr("fill", "#555")
        .attr("text-anchor", "middle")
        .text(d => d.label || "");

    const edgeLabelElements = edgeLabelEnter.merge(edgeLabelSelection);

    // Physique du graphe: mise à jour des positions à chaque tick
    simulation.on("tick", () => {
        linkElements.attr("d", d => {
            const x1 = d.source.x;
            const y1 = d.source.y;
            const x2 = d.target.x;
            const y2 = d.target.y;

            const dx = x2 - x1;
            const dy = y2 - y1;
            const cx = x1 + dx / 2 + dy * 0.1;
            const cy = y1 + dy / 2 - dx * 0.1;
            return `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`;
        });

        nodeElements.each(function (d) {
            const node = d3.select(this);
            if (d.label === d.id) {
                node.attr("transform", `translate(${d.x}, ${d.y})`);
            } else {
                node.attr("cx", d => d.x || 0)
                    .attr("cy", d => d.y || 0);
            }
        });

        labelElements
            .attr("x", d => d.x || 0)
            .attr("y", d => d.y || 0);

        edgeLabelElements
            .attr("transform", d => {
                const x = (d.source.x + d.target.x) / 2;
                const y = (d.source.y + d.target.y) / 2;
                const angle = Math.atan2(d.target.y - d.source.y, d.target.x - d.source.x) * 180 / Math.PI;
                const correctedAngle = (angle > 90 || angle < -90) ? angle + 180 : angle;
                return `translate(${x}, ${y}) rotate(${correctedAngle})`;
            });
    });
}

// Gestion du drag des nodes (fixation temporaire des positions)
function drag(simulation) {
    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        if (d.fy !== 100) d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        if (d.fy !== 100) d.fy = event.y;
    }

    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        if (d.fy !== 100) d.fy = null;
    }

    return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
}

// Petit message temporaire près d’un node (ex: absence de voisins)
function showNodeMessage(svg, node, message) {
    svg.selectAll(".node-message").remove();
    const g = svg.append("g")
        .attr("class", "node-message");

    g.append("rect")
        .attr("x", node.x - message.length * 3)
        .attr("y", node.y - 30)
        .attr("rx", 6)
        .attr("ry", 6)
        .attr("fill", "rgba(0,0,0,0.7)")
        .attr("stroke", "white")
        .attr("stroke-width", 1)
        .attr("width", message.length * 7)
        .attr("height", 20);

    g.append("text")
        .attr("x", node.x)
        .attr("y", node.y - 15)
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .attr("font-size", "12px")
        .text(message);

    setTimeout(() => {
        g.transition().duration(500).style("opacity", 0).remove();
    }, 2000);
}

// Toast simple (succès/sauvegarde)
function showToast(message) {
    const toast = document.createElement("div");
    toast.textContent = message;
    toast.style.position = "fixed";
    toast.style.top = "20px";
    toast.style.right = "20px";
    toast.style.background = "#4caf50";
    toast.style.color = "white";
    toast.style.padding = "10px 20px";
    toast.style.borderRadius = "8px";
    toast.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
    toast.style.zIndex = "1000";
    const anchor = document.getElementById("button_valider") || document.body;
    anchor.insertAdjacentElement("afterend", toast);
    setTimeout(() => toast.remove(), 3000);
}


// ===================== SVG EXPORT (NEW TAB + AUTO-DOWNLOAD) =====================
function ensureNamespacesAndViewBox(svg) {
    if (!svg.getAttribute("xmlns")) svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    if (!svg.getAttribute("xmlns:xlink")) svg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
    if (!svg.getAttribute("viewBox")) {
        const w = +svg.getAttribute("width") || svg.clientWidth || 800;
        const h = +svg.getAttribute("height") || svg.clientHeight || 600;
        svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    }
}
function svgToString(svgNode) {
    ensureNamespacesAndViewBox(svgNode);
    const ser = new XMLSerializer();
    let s = ser.serializeToString(svgNode);
    if (!s.startsWith("<?xml")) {
        s = '<?xml version="1.0" standalone="no"?>\n' + s;
    }
    return s;
}
function stringToBase64Utf8(s) {
    const bytes = new TextEncoder().encode(s);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
}
function openNewTabAndDownloadSVG(svgString, filename) {
    const b64 = stringToBase64Utf8(svgString);
    const html = `<!doctype html><html><meta charset="utf-8"><title>Export SVG</title><body>
<script>
(function(){
  try{
    const b64 = "${b64}";
    const bin = atob(b64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i=0;i<len;i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], {type: "image/svg+xml;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "${filename}";
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){ URL.revokeObjectURL(url); window.close(); }, 800);
  }catch(e){
    document.body.innerHTML = "<pre>"+String(e)+"</pre>";
  }
})();
<\/script>
</body></html>`;
    const win = window.open("", "_blank");
    if (!win) return false;
    win.document.open();
    win.document.write(html);
    win.document.close();
    return true;
}
function exportCurrentSVG_NewTab() {
    const svgSel = (window.graphPrincipal && window.graphPrincipal.svg) ? window.graphPrincipal.svg : d3.select("#graph svg");
    const svgEl = svgSel && svgSel.node ? svgSel.node() : document.querySelector("#graph svg");
    if (!svgEl) { alert("Le graphe n'est pas encore initialisé."); return; }
    const clone = svgEl.cloneNode(true);
    const svgString = svgToString(clone);
    const u = (typeof user === "string" && user) ? user : "user";
    const c = (typeof course === "string" && course) ? course : "course";
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `ExplainGraph_${u}_${c}_${ts}.svg`;
    const opened = openNewTabAndDownloadSVG(svgString, filename);
    if (!opened) {
        const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        a.remove();
    }
}
// =============================================================================

// === Main onload ===
// Branchement des handlers UI, initialisation du graphe, et gestion du resize
window.onload = function () {

    // Injection du bouton "Export SVG" si absent, puis binding du clic
    (function () {
        const controls = document.querySelector(".graph-controls");
        if (controls && !document.getElementById("exportSvg")) {
            const b = document.createElement("button");
            b.className = "button";
            b.id = "exportSvg";
            b.title = "Export the current graph as SVG (new tab + download)";
            b.textContent = "Export SVG";
            controls.appendChild(b);
        }
        const btn = document.getElementById("exportSvg");
        if (btn) btn.addEventListener("click", exportCurrentSVG_NewTab);
    })();

    const container = document.getElementById("graph");
    const graphe_svg = d3.select("#graph");
    const graphCtx = drawGraph(container, data["nodes"], data["edges"]);
    window.graphPrincipal = graphCtx;

    // Resize: recalcul des forces + dimensions du SVG
    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            const width = entry.contentRect.width;
            const height = entry.contentRect.height;
            updateGraphSize(width, height, window.graphPrincipal.simulation, window.graphPrincipal.svg);
        }
    });
    resizeObserver.observe(container);

    // Bouton: recadrer la vue sur l’ensemble du graphe
    document.getElementById("resetView").addEventListener("click", () => {
        fitToGraph(window.graphPrincipal.svg, window.graphPrincipal.zoom);
    });

    // Bouton: réinitialiser le chemin courant et sa vue
    document.getElementById("resetPath").addEventListener("click", () => {
        const currentPath = allPaths[index_path_affiché];
        data = {
            nodes: [...currentPath.nodes],
            edges: [...currentPath.edges]
        };
        updateGraph(
            data.nodes,
            data.edges,
            window.graphPrincipal.svg,
            window.graphPrincipal.linkGroup,
            window.graphPrincipal.nodeGroup,
            window.graphPrincipal.labelGroup,
            window.graphPrincipal.edgeLabelGroup,
            window.graphPrincipal.simulation,
            window.graphPrincipal.zoomGroup
        );
        fitToGraph(window.graphPrincipal.svg, window.graphPrincipal.zoom);
        liste_node_click = [];
        parent = {};
        path2_en_cours = false;
    });

    // Clic sur le graphe: ouvrir la modale de prédicats ou replier le voisinage
    graphe_svg.on('click', function (event) {
        window.graphPrincipal.simulation.stop();
        const transform = d3.zoomTransform(window.graphPrincipal.svg.node());
        const [mouseX, mouseY] = transform.invert(d3.pointer(event));
        const clickedNode = data["nodes"].find(d => {
            const dx = d.x - mouseX;
            const dy = d.y - mouseY;
            return Math.sqrt(dx * dx + dy * dy) < 10;
        });
        let nodeId = null;
        if (clickedNode) {
            nodeId = clickedNode.id;
        }
        if (!nodeId) return;

        // 1) Node jamais exploré: ouvrir modale de sélection des prédicats sortants
        if (!liste_node_click.includes(nodeId)) {
            fetch(`http://localhost:5000/api/predicats_node?node=${encodeURIComponent(nodeId)}`)
                .then(res => {
                    if (!res.ok) throw new Error("HTTP error " + res.status);
                    return res.json();
                })
                .then(predicats => {
                    if (!predicats || predicats.error) {
                        showNodeMessage(window.graphPrincipal.svg, clickedNode, "No predicates found.");
                        return;
                    }
                    if (!predicats.length) {
                        showNodeMessage(window.graphPrincipal.svg, clickedNode, "No outgoing neighbors");
                        return;
                    }
                    // Construire la modale
                    d3.selectAll(".modal-overlay").remove();
                    const overlay = d3.select("body").append("div")
                        .attr("class", "modal-overlay");
                    const modal = overlay.append("div")
                        .attr("class", "predicat-modal");
                    modal.append("h4").text("Outgoing predicates of the node : " + clickedNode.label);
                    modal.append("p").text("Choose what predicates to show in the node's neighborhood :");
                    const checklist = modal.append("div");
                    predicats.forEach(p => {
                        const label = checklist.append("label").style("display", "block");
                        const val = p.split("/").pop();
                        label.append("input")
                            .attr("type", "checkbox")
                            .attr("class", "myCheckbox")
                            .attr("value", val)
                            .property("checked", false);
                        label.append("span").text(" " + val);
                    });
                    const btns = modal.append("div").attr("class", "buttons");
                    btns.append("button")
                        .attr("class", "button")
                        .text("Select all").on("click", () => {
                            checklist.selectAll("input").property("checked", true);
                        });
                    btns.append("button")
                        .attr("class", "button")
                        .text("Unselect all").on("click", () => {
                        checklist.selectAll("input").property("checked", false);
                        });
                    btns.append("button")
                        .attr("class", "button")
                        .text("Confirm").on("click", () => {
                            liste_node_click.push(nodeId);
                            const checkboxes = document.querySelectorAll('.myCheckbox:checked');
                            const cb_predicates = Array.from(checkboxes).map(cb => cb.value);
                            const encodedNodeId = encodeURIComponent(nodeId);
                            // Envoi au backend des prédicats choisis pour étendre le voisinage
                            fetch(`http://localhost:5000/api/pathETvoisins?start=${user}&end=${course}&voisin=${encodedNodeId}&choix=${choix}`, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({ predicates: cb_predicates })
                            })
                                .then(res => res.json())
                                .then(data2 => {
                                    // Fusion sans doublons (nodes/edges)
                                    const existingNodeIds = new Set(data.nodes.map(n => n.id));
                                    const newNodes = data2.nodes.filter(n => !existingNodeIds.has(n.id));
                                    for (const n of newNodes) {
                                        parent[n.id] = nodeId;
                                    }
                                    const existingEdgeKeys = new Set(data.edges.map(e => `${e.from}->${e.to}`));
                                    const newEdges = data2.edges.filter(e => !existingEdgeKeys.has(`${e.from}->${e.to}`));
                                    newNodes.forEach(n => {
                                        n.x = Math.random() * 600;
                                        n.y = Math.random() * 600;
                                    });
                                    data = {
                                        nodes: [...data.nodes, ...newNodes],
                                        edges: [...data.edges, ...newEdges]
                                    };
                                    if (data2.nodes.length === 0) {
                                        // rien de nouveau: on retire le node de la liste cliquée
                                        const idx = liste_node_click.indexOf(nodeId);
                                        if (idx !== -1) liste_node_click.splice(idx, 1);
                                    } else {
                                        updateGraph(data["nodes"], data["edges"],
                                            window.graphPrincipal.svg,
                                            window.graphPrincipal.linkGroup,
                                            window.graphPrincipal.nodeGroup,
                                            window.graphPrincipal.labelGroup,
                                            window.graphPrincipal.edgeLabelGroup,
                                            window.graphPrincipal.simulation,
                                            window.graphPrincipal.zoomGroup);
                                    }
                                });
                            overlay.remove();
                        });
                    btns.append("button")
                        .attr("class", "button")
                        .text("Cancel").on("click", () => {
                            overlay.remove();
                        });
                });
        } else {
            // 2) Node déjà exploré: tentative de repli de son voisinage
            let hasGrandchild = false;
            for (const k of Object.keys(parent)) {
                if (parent[k] === nodeId && Object.values(parent).includes(k)) {
                    hasGrandchild = true;
                    break;
                }
            }
            if (!hasGrandchild) {
                const idx = liste_node_click.indexOf(nodeId);
                if (idx !== -1) liste_node_click.splice(idx, 1);
                const encodedNodeId = encodeURIComponent(nodeId);
                fetch(`http://localhost:5000/api/voisins?voisin=${encodedNodeId}&choix=${choix}`)
                    .then(res => res.json())
                    .then(data2 => {
                        // Éléments à supprimer (hors chemin actif)
                        const idsToRemove = new Set(data2.nodes.map(n => n.id));
                        const edgesToRemove = new Set(data2.edges.map(e => `${e.from}->${e.to}`));
                        let pathNodeIds = new Set(path.nodes.map(n => n.id));
                        let pathEdge = new Set(path.edges.map(e => `${e.from}->${e.to}`));
                        if (path2_en_cours) {
                            pathNodeIds = new Set(path2.nodes.map(n => n.id));
                            pathEdge = new Set(path2.edges.map(e => `${e.from}->${e.to}`));
                        }
                        // Filtrage nodes: ne pas retirer ceux du path ou ceux qui ont des enfants
                        data.nodes = data.nodes.filter(n => {
                            const hasChild = Object.values(parent).includes(n.id);
                            if (idsToRemove.has(n.id) && !pathNodeIds.has(n.id) && !hasChild) {
                                parent[n.id] = null;
                                if (liste_node_click.includes(n.id)) {
                                    const pos = liste_node_click.indexOf(n.id);
                                    liste_node_click.splice(pos, 1);
                                }
                                return false;
                            }
                            return true;
                        });
                        // Filtrage edges: garder cohérent avec nodes + ne pas retirer les arêtes du path
                        const validNodeIds = new Set(data.nodes.map(n => n.id));
                        data.edges = data.edges.filter(e =>
                            validNodeIds.has(e.from) &&
                            validNodeIds.has(e.to) &&
                            !(edgesToRemove.has(`${e.from}->${e.to}`) && !pathEdge.has(`${e.from}->${e.to}`))
                        );
                        // Nettoyage liste_node_click si plus de parent-enfant actifs
                        let stillHasParentChild = false;
                        for (const nId of liste_node_click) {
                            if (Object.values(parent).includes(nId)) {
                                stillHasParentChild = true;
                                break;
                            }
                        }
                        if (!stillHasParentChild) {
                            liste_node_click = [];
                        }
                        updateGraph(
                            data["nodes"],
                            data["edges"],
                            window.graphPrincipal.svg,
                            window.graphPrincipal.linkGroup,
                            window.graphPrincipal.nodeGroup,
                            window.graphPrincipal.labelGroup,
                            window.graphPrincipal.edgeLabelGroup,
                            window.graphPrincipal.simulation,
                            window.graphPrincipal.zoomGroup
                        );
                    });
            } else {
                alert("Clique d'abord sur les nodes enfants de celui-là !");
            }
        }
    });
};

// ------------------FONCTIONS COMPLEXES------------------- //

// Validation de l’ID + collecte des infos “General Information”
function validateLogin() {
    const userID = document.getElementById("userId").value.trim();

    const ageStr = document.getElementById("age")?.value.trim() || "";
    const age = ageStr === "" ? "" : parseInt(ageStr, 10);

    const gender = document.querySelector('input[name="gender"]:checked')?.value || "Prefer not to say";

    const educationLevelSelect = document.getElementById("educationLevel");
    const educationLevel = educationLevelSelect ? educationLevelSelect.value : "";
    const educationOther = document.getElementById("educationOther")?.value.trim() || "";
    const education = educationLevel === "Other" ? (educationOther || "Other") : educationLevel;

    const fieldStudy = document.getElementById("fieldStudy")?.value.trim() || "";

    const usedReco = document.querySelector('input[name="usedReco"]:checked')?.value || "";

    const frequency = document.getElementById("frequency")?.value || "";

    if (userID === "") {
        alert("Merci de saisir un ID utilisateur.");
        return;
    }
    if (ageStr !== "" && (isNaN(age) || age < 10 || age > 120)) {
        alert("Merci d'entrer un âge valide (10–120) ou de laisser le champ vide.");
        return;
    }

    // 1) Mémoriser les infos participant dans l’état global
    participant_info = {
        user_id: userID,
        age: ageStr === "" ? "" : age,
        gender: gender,
        education_level: education,
        field_of_study_or_work: fieldStudy,
        used_course_recommendation_system: usedReco,
        elearning_frequency: frequency
    };
    if (typeof reponse_user_study !== "object" || !reponse_user_study) {
        reponse_user_study = {};
    }
    reponse_user_study.participant = participant_info;

    // 2) Conserver votre logique de vérification d'ID et chargement
    fetch(`http://localhost:5000/api/random_course?start=${userID}`)
        .then(res => res.json())
        .then(data => {
            if (data.error || !data.course) {
                alert("ID invalide ou aucun cours recommandé. Veuillez réessayer avec un autre identifiant.");
            } else {
                document.getElementById("login-overlay").style.display = "none";
                user = userID;
                loadPath();
            }
        })
        .catch(err => {
            console.error("Erreur lors de la vérification :", err);
            alert("Impossible de vérifier l'ID (serveur indisponible ?)");
        });
}


// Affiche le chemin courant (métriques + recentrage + questions)
function afficherCheminCourant() {
    liste_node_click = [];
    parent = {};
    path2_en_cours = false;
    const currentPath = allPaths[index_path_affiché];
    data = { nodes: [...currentPath.nodes], edges: [...currentPath.edges] };
    path = {
        nodes: [...currentPath.nodes],
        edges: [...currentPath.edges]
    };
    updateGraph(
        data.nodes,
        data.edges,
        window.graphPrincipal.svg,
        window.graphPrincipal.linkGroup,
        window.graphPrincipal.nodeGroup,
        window.graphPrincipal.labelGroup,
        window.graphPrincipal.edgeLabelGroup,
        window.graphPrincipal.simulation,
        window.graphPrincipal.zoomGroup
    );
    const container = document.getElementById("ligne-info-chemin");
    container.innerHTML = "";
    document.getElementById("num-chemin").innerHTML = "<strong>Path " + (index_path_affiché + 1) + ' / ' + allPaths.length + "</strong>";
    const line = document.createElement("div");
    line.innerHTML = "S_sim = " + currentPath['S_sim'] + ", S_pop = " + currentPath['S_pop'] + ", S_div = " + currentPath['S_div'] + " --> " + currentPath['Score'];
    container.appendChild(line);
    const line2 = document.createElement("div");
    line2.innerHTML = "Length = " + currentPath['longueur'];
    container.appendChild(line2);
    const line3 = document.createElement("div");
    line3.innerHTML = "Pattern : " + currentPath['pattern'];
    container.appendChild(line3);
    setTimeout(() => {
        fitToGraph(window.graphPrincipal.svg, window.graphPrincipal.zoom);
    }, 200);
    afficherQuestionsPourChemin(currentPath);
}

// Construit le formulaire d’évaluation pour le chemin affiché
function afficherQuestionsPourChemin(path) {
    const container = document.getElementById("formulaire-questions");
    container.innerHTML = "";
    const form = document.createElement("form");
    let i_qt = 0;
    for (const qt of liste_question_possible) {
        const question = document.createElement("div");
        question.innerHTML = `<strong>${qt}</strong>`;
        form.appendChild(question);
        const select = document.createElement("select");
        select.name = "answer" + i_qt;
        select.className = "mySelect";
        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "-- Select an answer --";
        defaultOption.disabled = true;
        defaultOption.selected = true;
        select.appendChild(defaultOption);
        for (const reponse of liste_answer_possible) {
            const option = document.createElement("option");
            option.value = reponse;
            option.textContent = reponse;
            select.appendChild(option);
        }
        const pathKey = "path_" + index_path_affiché;
        if (reponse_user_study.path_feedback &&
            reponse_user_study.path_feedback[pathKey] &&
            reponse_user_study.path_feedback[pathKey][select.name]) {
            select.value = reponse_user_study.path_feedback[pathKey][select.name];
        }
        form.appendChild(select);
        i_qt++;
    }
    const button_valider = document.createElement("button");
    button_valider.id = "button_valider";
    button_valider.className = "button";
    button_valider.innerHTML = "Validate";
    form.appendChild(button_valider);
    button_valider.addEventListener("click", (e) => {
        e.preventDefault();
        let allAnswered = true;
        const responses = {};
        form.querySelectorAll("select").forEach((select) => {
            if (!select.value) {
                allAnswered = false;
                select.previousSibling.style.color = "red";
            } else {
                responses[select.name] = select.value;
                select.previousSibling.style.color = "";
            }
        });
        if (allAnswered) {
            // Ajout de métadonnées du chemin pour analyse ultérieure
            responses["longueur"] = path["longueur"];
            responses["S_sim"] = path["S_sim"];
            responses["S_pop"] = path["S_pop"];
            responses["S_div"] = path["S_div"];
            responses["Score"] = path["Score"];
            responses["path"] = path["path"];
            if (!reponse_user_study.path_feedback) {
                reponse_user_study.path_feedback = {};
            }
            const pathKey = "path_" + index_path_affiché;
            reponse_user_study.path_feedback[pathKey] = responses;
            showToast("Votre réponse a bien été enregistrée !");
            console.log("Réponses enregistrées :", responses);
        } else {
            alert("Merci de répondre à toutes les questions.");
        }
    });
    container.appendChild(form);
}

// Affiche/Cacher le loader global
function showLoader() {
    document.getElementById("loader").style.display = "flex";
}
function hideLoader() {
    document.getElementById("loader").style.display = "none";
}


// Charge un cours recommandé puis tous les chemins, les questions et le top5
function loadPath() {
    path2_en_cours = false;
    parent = {};
    path = { nodes: [], edges: [] };
    data = { nodes: [], edges: [] };
    allPaths = [];
    reponse_user_study.path_feedback = {};
    const element = document.getElementById("validerQuestions");
    if (element) {
        element.remove();
    }
    updateGraph(data["nodes"], data["edges"],
        window.graphPrincipal.svg,
        window.graphPrincipal.linkGroup,
        window.graphPrincipal.nodeGroup,
        window.graphPrincipal.labelGroup,
        window.graphPrincipal.edgeLabelGroup,
        window.graphPrincipal.simulation,
        window.graphPrincipal.zoomGroup);

    // Reset du zoom
    setTimeout(() => {
        window.graphPrincipal.svg.transition().duration(750).call(
            window.graphPrincipal.zoom.transform,
            d3.zoomIdentity
        );
    }, 300);

    index_path_affiché = 0;

    // Loader visible pendant la première requête
    showLoader();

    // 1) Choisir un cours aléatoire pour l’utilisateur
    fetch(`http://localhost:5000/api/random_course?start=${user}`)
        .then(res => res.json())
        .then(data4 => {
            if (data4.error) {
                hideLoader();
                alert(data4.error);
                return;
            }
            course = data4.course;
            const affichageDiv = document.getElementById("affichage-cours");
            affichageDiv.innerHTML = `Recommended course : <strong>${course}</strong>`;

            // 2) Récupérer tous les chemins expliquant la reco
            fetch(`http://localhost:5000/api/all_path?start=${user}&end=${course}&w=true&choix=${choix}`)
                .then(res => res.json())
                .then(data2 => {
                    hideLoader(); // stop loader dès réception

                    const texte = data2.texte;
                    document.getElementById('Explication').innerHTML = texte;
                    const precedent = document.getElementById("buttonPrecedent");
                    precedent.innerHTML = '<';
                    allPaths = data2.all_paths;
                    afficherCheminCourant();
                    const separatorPath = document.getElementById("separateurChemin");
                    separatorPath.innerHTML = `
                        <hr style="margin: 40px 0; border-top: 2px solid #ccc;">
                        <h3 style="text-align: center; margin-bottom: 10px;">
                        ⬇️Questions about this path⬇️
                        </h3>
                        <p style="text-align: center; margin-bottom: 20px;">For each path, please answer these questions and validate your answers.</p>
                    `;
                    const suivant = document.getElementById("buttonSuivant");
                    suivant.innerHTML = '>';
                    suivant.style.visibility = 'visible';
                    const separator = document.getElementById("separateurGeneral");
                    separator.innerHTML = `
                        <hr style="margin: 40px 0; border-top: 2px solid #ccc;">
                        <h3 style="text-align: center; margin-bottom: 20px;">
                        ⬇️General Feedback on the Explanation Interface⬇️
                        </h3>
                    `;

                    // Générer le nouveau questionnaire (sections complètes)
                    const containerQuG = document.getElementById("questionsGenerales");
                    containerQuG.innerHTML = '';
                    buildSurveySections(containerQuG);

                    // Bouton global de sauvegarde des réponses
                    const validerQuestions = document.createElement('button');
                    validerQuestions.className = 'button';
                    validerQuestions.id = 'validerQuestions';
                    validerQuestions.innerHTML = 'Save';
                    document.getElementById("center-panel").appendChild(validerQuestions);

                    // Navigation entre chemins
                    const precedentHandler = () => {
                        if (index_path_affiché - 1 > -1) {
                            suivant.style.visibility = 'visible';
                            index_path_affiché -= 1;
                            if (index_path_affiché === 0) {
                                precedent.style.visibility = 'hidden';
                            }
                        }
                        afficherCheminCourant();
                    };
                    const suivantHandler = () => {
                        precedent.style.visibility = 'visible';
                        if (index_path_affiché + 1 < allPaths.length) {
                            index_path_affiché += 1;
                            if (index_path_affiché + 1 === allPaths.length) {
                                suivant.style.visibility = 'hidden';
                            }
                        }
                        afficherCheminCourant();
                    };
                    precedent.onclick = precedentHandler;
                    suivant.onclick = suivantHandler;

                    // Validation finale: vérifie que tout est répondu (par chemin + général)
                    validerQuestions.addEventListener("click", () => {
                        let allPathAnswered = true;
                        allPaths.forEach((_, idx) => {
                            const pathKey = "path_" + idx;
                            const answers = reponse_user_study.path_feedback[pathKey];
                            if (!answers) {
                                allPathAnswered = false;
                                return;
                            }
                            liste_question_possible.forEach((_, qIndex) => {
                                const qName = "answer" + qIndex;
                                if (!answers[qName] || answers[qName] === "-- Select an answer --") {
                                    allPathAnswered = false;
                                }
                            });
                        });
                        const generalBlocks = document.querySelectorAll("#questionsGenerales .question-block");
                        let allGeneralAnswered = true;
                        generalBlocks.forEach(block => {
                            block.style.color = "";
                            const hasRadio = block.querySelector('input[type="radio"]');
                            const hasSelect = block.querySelector('select');
                            const hasTextarea = block.querySelector('textarea');
                            let ok = true;
                            if (hasRadio) ok = !!block.querySelector('input[type="radio"]:checked');
                            if (hasSelect) ok = ok && !!block.querySelector('select').value;
                            if (hasTextarea && block.getAttribute("data-required") === "true") {
                                ok = ok && !!block.querySelector('textarea').value.trim();
                            }
                            if (!ok) {
                                allGeneralAnswered = false;
                                block.style.color = "red";
                            }
                        });
                        if (allPathAnswered && allGeneralAnswered) {
                            reponse_user_study.general_feedback = collectGeneralFeedback();
                            fetch("http://localhost:5000/api/user_study", {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({ user_study: reponse_user_study, user_id: user })
                            })
                                .then(response => response.json())
                                .then(() => {
                                    alert("Réponses envoyées avec succès !");
                                })
                                .catch(() => {
                                    alert("Erreur lors de l’envoi des réponses.");
                                });
                        } else {
                            alert("Merci de répondre à toutes les questions.");
                        }
                    });
                })
                .catch(err => {
                    hideLoader();
                    console.error(err);
                    alert("Erreur lors de la récupération des chemins d'explication.");
                });

            // 3) Top 5 des attributs communs (chart)
            fetch(`http://localhost:5000/api/top5?user=${user}&course=${course}`)
                .then(response => response.json())
                .then(data => {
                    document.getElementById("messageTop5").innerText = "";
                    if (Object.keys(data).length === 0) {
                        document.getElementById("top5chart").style.display = "none";
                        document.getElementById("messageTop5").innerText = "Aucun attribut en commun";
                        return;
                    }
                    const labels = Object.keys(data).map(uri => uri.split("/").pop());
                    const values = Object.values(data).map(Number);
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
                    document.getElementById("top5chart").style.display = "block";
                    document.getElementById("messageTop5").innerText = "";
                })
                .catch(error => {
                    console.error("Erreur lors du chargement du top 5 :", error);
                });

        })
        .catch(err => {
            hideLoader();
            console.error(err);
            alert("Erreur lors de la récupération du cours aléatoire.");
        });
}


// --- Autocomplete pour #userId ---
document.addEventListener('DOMContentLoaded', function () {
    const input = document.getElementById("userId");
    const list = document.getElementById("userId-suggest");
    if (!input || !list) return;

    let currentIdx = -1;
    let lastQuery = "";
    let timer;

    function show(items) {
        list.innerHTML = "";
        if (!items || !items.length) { list.style.display = "none"; return; }
        items.forEach((id, i) => {
            const li = document.createElement("li");
            li.textContent = id;
            li.style.padding = "8px 10px";
            li.style.cursor = "pointer";
            li.addEventListener("mouseenter", () => highlight(i));
            li.addEventListener("mousedown", (e) => {
                e.preventDefault();
                input.value = id;
                hide();
            });
            list.appendChild(li);
        });
        list.style.display = "block";
        currentIdx = -1;
    }

    function hide() { list.style.display = "none"; currentIdx = -1; }
    function highlight(i) {
        const items = Array.from(list.children);
        items.forEach((el, idx) => el.style.background = (idx === i) ? "#f3f6fb" : "");
        currentIdx = i;
    }

    function fetchUsers(q) {
        fetch(`http://localhost:5000/api/users?q=${encodeURIComponent(q)}&limit=10`)
            .then(r => r.ok ? r.json() : [])
            .then(arr => show(arr))
            .catch(() => hide());
    }

    input.addEventListener("input", () => {
        const q = input.value.trim();
        if (q === lastQuery) { return; }
        lastQuery = q;
        clearTimeout(timer);
        if (q.length < 1) { hide(); return; }
        timer = setTimeout(() => fetchUsers(q), 200);
    });

    input.addEventListener("keydown", (e) => {
        const items = Array.from(list.children);
        if (list.style.display === "none" || !items.length) return;
        if (e.key === "ArrowDown") { e.preventDefault(); highlight(Math.min(currentIdx + 1, items.length - 1)); }
        else if (e.key === "ArrowUp") { e.preventDefault(); highlight(Math.max(currentIdx - 1, 0)); }
        else if (e.key === "Enter") {
            if (currentIdx >= 0) { e.preventDefault(); items[currentIdx].dispatchEvent(new Event("mousedown")); }
        } else if (e.key === "Escape") { hide(); }
    });

    document.addEventListener("click", (e) => {
        if (!list.contains(e.target) && e.target !== input) hide();
    });

    // Affichage conditionnel du champ "educationOther"
    const edu = document.getElementById("educationLevel");
    const eduOther = document.getElementById("educationOther");
    if (edu && eduOther) {
        const toggle = () => {
            if (edu.value === "Other") {
                eduOther.classList.remove("hidden");
            } else {
                eduOther.classList.add("hidden");
                eduOther.value = "";
            }
        };
        edu.addEventListener("change", toggle);
        toggle();
    }

});

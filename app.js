// === Globals ===
var index_path_affiché = 0; // numero du petit chemin affiché
let liste_node_click = []; // liste nodes cliqués
let top5ChartInstance = null; //Existance du graphe top 5
let reponse_user_study = {
    general_feedback: {},
    path_feedback: {}
}; // Dictionnaire des réponses aux question du user study
var choix = "false"; // Choix = false --> utilisation graphe pondéré par défaut, choix = true --> utilisation graphe pondéré en fct des prédicats choisis par l'utilisateur
var path = { nodes: [], edges: [] }; // chemin principal
var path2 = { nodes: [], edges: [] }; // chemin principal avec ajout/remplacé par des petits chemins (mode ajout ou échanger)
var data = { nodes: [], edges: [] }; // graphe
var course = ""; // cours recommandé
let user = null;
const liste_answer_possible = ['strongly agree', 'agree', 'neutre', 'disagree', 'strongly disagree']; // Réponses possibles aux questions
// Questions portant sur l'explication de manière générale
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
// Questions portant sur chacun des chemins proposés dans l'explication
const liste_question_possible = [
    'Without adding paths or modifying the graph, the explanation path gives me enough information on why this course was recommended to me.',
    'This explanation path has irrelevant details, which make it overwhelming/difficult to understand.',
    'The topics mentioned in this explanation path are familiar to me.',
    'This explanation path seems aligned with my personal interests.'
];

var path2_en_cours = false; // Vaut true si on modifie le chemin principal initial (en ajoutant ou échangeant avec un autre chemin) 
var mode = "modeAjoutGraph"; // Mode d'intéraction avec les autres chemins. Les deux modes sont :"modeAjoutGraph" et "modeEchangeGraph"

// Extra globals that were implicit in original page
let allPaths = [];
let parent = {};


// -----------------FONCTIONS SIMPLES---------------//
function getNodeColor(group) {
    return group === 0 ? "orange" :
        group === 1 ? "rgb(245, 221, 6)" :
            group === 2 ? "rgb(236, 112, 90)" :
                group === 3 ? "rgb(67, 143, 206)" : "#bce98f";
}

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

function updateGraphSize(width, height, simulation, svg) {
    svg
        .attr("width", width)
        .attr("height", height);

    simulation.force("center", d3.forceCenter(width / 2, height / 2).strength(0.01));
    simulation.alphaDecay(0.1);
    simulation.alpha(1).restart();
}

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

function collectGeneralFeedback() {
    const feedback = {};
    const selects = document.querySelectorAll("#questionsGenerales select");
    selects.forEach(select => {
        const label = select.previousElementSibling?.textContent?.trim() || select.name;
        feedback[label] = select.value;
    });
    return feedback;
}

function drawGraph(container, nodesData, edgesData) {
    if (!container) {
        console.error("Élément #graph-container introuvable.");
        return;
    }
    container.innerHTML = "";

    var width = container.clientWidth;
    var height = container.clientHeight;
    if (container.parentElement.style.display == "none") {
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

    const zoomGroup = svg.append("g").attr("class", "zoom-group");
    const linkGroup = zoomGroup.append("g").attr("class", "links");
    const nodeGroup = zoomGroup.append("g").attr("class", "nodes");
    const labelGroup = zoomGroup.append("g").attr("class", "labels");
    const edgeLabelGroup = zoomGroup.append("g").attr("class", "edge-labels");

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

    d3.select("svg").style("pointer-events", "all");
    d3.select("g.zoom-group").style("pointer-events", "all");
    d3.selectAll(".nodes circle").style("pointer-events", "all");

    const zoom = d3.zoom()
        .scaleExtent([0.1, 5])
        .on("zoom", (event) => {
            zoomGroup.attr("transform", event.transform);
        });

    svg.call(zoom);

    let simulation = d3.forceSimulation()
        .force("link", d3.forceLink().id(d => d.id).distance(200))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(+svg.attr("width") / 2, +svg.attr("height") / 2).strength(0.01))
        .alphaDecay(0.1);

    updateGraph(nodesData, edgesData, svg, linkGroup, nodeGroup, labelGroup, edgeLabelGroup, simulation, zoomGroup);
    return { svg, linkGroup, nodeGroup, labelGroup, edgeLabelGroup, simulation, zoomGroup, zoom };
}

function updateGraph(nodesData, edgesData, svg, linkGroup, nodeGroup, labelGroup, edgeLabelGroup, simulation, zoomGroup) {
    const edgesD3 = edgesData.map(e => ({
        ...e,
        source: e.from,
        target: e.to
    }));

    nodesData.forEach(n => {
        if (n.x == null) n.x = Math.random() * +svg.attr("width");
        if (n.y == null) n.y = Math.random() * +svg.attr("height");
    });

    simulation.nodes(nodesData);
    simulation.force("link").links(edgesD3);
    simulation.alpha(1).restart();

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

    const nodeSelection = nodeGroup.selectAll(".node")
        .data(nodesData, d => d.id);

    nodeSelection.exit().remove();

    const attrs = {
        onNodeHover: function (value) {
            // console.log("Hovered:", value);
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
            if (value != '') {
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

    const labelSelection = labelGroup.selectAll("text")
        .data(nodesData, d => d.id);

    labelSelection.exit().remove();

    const labelEnter = labelSelection.enter()
        .append("text")
        .text(d => {
            if (d.label !== d.id)
                return d.label;
        })
        .attr("font-size", "10px")
        .attr("text-anchor", "middle")
        .attr("dy", 15);

    const labelElements = labelEnter.merge(labelSelection);

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
    document.getElementById("button_valider").insertAdjacentElement("afterend", toast);
    setTimeout(() => toast.remove(), 3000);
}

// === Main onload ===
window.onload = function () {
    const container = document.getElementById("graph");
    const graphe_svg = d3.select("#graph");
    const graphCtx = drawGraph(container, data["nodes"], data["edges"]);
    window.graphPrincipal = graphCtx;

    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            const width = entry.contentRect.width;
            const height = entry.contentRect.height;
            updateGraphSize(width, height, window.graphPrincipal.simulation, window.graphPrincipal.svg);
        }
    });
    resizeObserver.observe(container);

    document.getElementById("resetView").addEventListener("click", () => {
        fitToGraph(window.graphPrincipal.svg, window.graphPrincipal.zoom);
    });

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

    graphe_svg.on('click', function (properties) {
        window.graphPrincipal.simulation.stop();
        const transform = d3.zoomTransform(window.graphPrincipal.svg.node());
        const [mouseX, mouseY] = transform.invert(d3.pointer(event));
        const clickedNode = data["nodes"].find(d => {
            const dx = d.x - mouseX;
            const dy = d.y - mouseY;
            return Math.sqrt(dx * dx + dy * dy) < 10;
        });
        if (clickedNode) {
            var nodeId = clickedNode.id;
        }
        if (!nodeId) return;
        if (!liste_node_click.includes(nodeId)) {
            fetch(`http://localhost:5000/api/predicats_node?node=${encodeURIComponent(nodeId)}`)
                .then(res => {
                    if (!res.ok) throw new Error("HTTP error " + res.status);
                    return res.json();
                })
                .then(predicats => {
                    if (predicats.error) {
                        checklist.append("p").text("No predicates found.");
                        return;
                    }
                    if (!predicats || predicats.length === 0) {
                        showNodeMessage(window.graphPrincipal.svg, clickedNode, "⚠️ No outgoing neighbors");
                        return;
                    }
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
                        label.append("input")
                            .attr("type", "checkbox")
                            .attr("class", "myCheckbox")
                            .attr("value", p.split("/").pop())
                            .property("checked", false);
                        label.append("span").text(" " + p.split("/").pop());
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
                            fetch(`http://localhost:5000/api/pathETvoisins?start=${user}&end=${course}&voisin=${encodedNodeId}&choix=${choix}`, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({ predicates: cb_predicates })
                            })
                                .then(res => res.json())
                                .then(data2 => {
                                    const existingNodeIds = new Set(data.nodes.map(n => n.id));
                                    const newNodes = data2.nodes.filter(n => !existingNodeIds.has(n.id));
                                    for (const n of newNodes) {
                                        parent[n.id] = nodeId;
                                    }
                                    const existingEdgeKeys = new Set(data.edges.map(e => `${e.from}->${e.to}`));
                                    const newEdges = data2.edges.filter(e => !existingEdgeKeys.has(`${e.from}->${e.to}`));
                                    newNodes.forEach(n => {
                                        n.x = Math.random() * +600;
                                        n.y = Math.random() * +600;
                                    });
                                    data = {
                                        nodes: [...data.nodes, ...newNodes],
                                        edges: [...data.edges, ...newEdges]
                                    };
                                    if (data2.nodes.length == 0) {
                                        liste_node_click.splice(liste_node_click.indexOf(nodeId), 1);
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
            var grandparent = 0;
            for (const k of Object.keys(parent)) {
                if (parent[k] == nodeId && Object.values(parent).includes(k)) {
                    grandparent = 1;
                }
            }
            if (grandparent == 0) {
                liste_node_click.splice(liste_node_click.indexOf(nodeId), 1);
                const encodedNodeId = encodeURIComponent(nodeId);
                fetch(`http://localhost:5000/api/voisins?voisin=${encodedNodeId}&choix=${choix}`)
                    .then(res => res.json())
                    .then(data2 => {
                        const idsToRemove = new Set(data2.nodes.map(n => n.id));
                        const edgesToRemove = new Set(data2.edges.map(e => `${e.from}->${e.to}`));
                        var pathNodeIds = new Set(path.nodes.map(n => n.id));
                        var pathEdge = new Set(path.edges.map(e => `${e.from}->${e.to}`));
                        if (path2_en_cours) {
                            pathNodeIds = new Set(path2.nodes.map(n => n.id));
                            pathEdge = new Set(path2.edges.map(e => `${e.from}->${e.to}`));
                        }
                        data.nodes = data.nodes.filter(n => {
                            let p = 0;
                            for (const k of Object.keys(parent)) {
                                if (parent[k] == n.id) {
                                    p = 1;
                                }
                            }
                            if (idsToRemove.has(n.id) && !pathNodeIds.has(n.id) && p == 0) {
                                parent[n.id] = null;
                                if (n.id in liste_node_click) {
                                    liste_node_click.splice(liste_node_click.indexOf(n.id), 1);
                                }
                                return false;
                            }
                            return true;
                        });
                        const validNodeIds = new Set(data.nodes.map(n => n.id));
                        data.edges = data.edges.filter(e =>
                            validNodeIds.has(e.from) && validNodeIds.has(e.to) && !(edgesToRemove.has(`${e.from}->${e.to}`) && !pathEdge.has(`${e.from}->${e.to}`))
                        );
                        let p = 0;
                        for (const n of liste_node_click) {
                            for (const k of Object.keys(parent)) {
                                if (parent[k] == n) {
                                    p = 1;
                                }
                            }
                        }
                        if (p == 0) {
                            liste_node_click.splice(liste_node_click.indexOf(n), 1);
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
function validateLogin() {
    const userID = document.getElementById("userId").value.trim();
    if (userID === "") {
        alert("Merci de saisir un ID utilisateur.");
        return;
    }
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

function showLoader() {
    document.getElementById("loader").style.display = "flex";
}

function hideLoader() {
    document.getElementById("loader").style.display = "none";
}


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

    setTimeout(() => {
        window.graphPrincipal.svg.transition().duration(750).call(
            window.graphPrincipal.zoom.transform,
            d3.zoomIdentity
        );
    }, 300);

    index_path_affiché = 0;

    // ➡️ Affichage du loader AVANT la première requête
    showLoader();

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

            // ➡️ Deuxième fetch : récupération des chemins
            fetch(`http://localhost:5000/api/all_path?start=${user}&end=${course}&w=true&choix=${choix}`)
                .then(res => res.json())
                .then(data2 => {
                    hideLoader(); // ⬅️ On cache le loader une fois la réponse reçue

                    var texte = data2.texte;
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
                    const containerQuG = document.getElementById("questionsGenerales");
                    containerQuG.innerHTML = '';
                    Object.entries(questions_reponses_generales).forEach(([questionText, options], index) => {
                        const wrapper = document.createElement("div");
                        wrapper.style.marginBottom = "20px";
                        const label = document.createElement("label");
                        label.htmlFor = `generalQuestion${index}`;
                        label.textContent = questionText;
                        label.style.display = "block";
                        label.style.fontWeight = "bold";
                        label.style.marginBottom = "8px";
                        wrapper.appendChild(label);
                        if (options.length > 0) {
                            const select = document.createElement("select");
                            select.id = `generalQuestion${index}`;
                            select.name = `generalQuestion${index}`;
                            select.style.padding = "8px 12px";
                            select.style.borderRadius = "6px";
                            select.style.border = "1px solid #ccc";
                            select.style.width = "100%";
                            select.style.maxWidth = "400px";
                            const defaultOption = document.createElement("option");
                            defaultOption.text = "-- Select an answer --";
                            defaultOption.disabled = true;
                            defaultOption.selected = true;
                            select.appendChild(defaultOption);
                            options.forEach(opt => {
                                const option = document.createElement("option");
                                option.value = opt;
                                option.textContent = opt;
                                select.appendChild(option);
                            });
                            wrapper.appendChild(select);
                        }
                        containerQuG.appendChild(wrapper);
                    });
                    const validerQuestions = document.createElement('button');
                    validerQuestions.className = 'button';
                    validerQuestions.id = 'validerQuestions';
                    validerQuestions.innerHTML = 'Save';
                    document.getElementById("center-panel").appendChild(validerQuestions);
                    const precedentHandler = () => {
                        if (index_path_affiché - 1 > -1) {
                            suivant.style.visibility = 'visible';
                            index_path_affiché -= 1;
                            if (index_path_affiché == 0) {
                                precedent.style.visibility = 'hidden';
                            }
                        }
                        afficherCheminCourant();
                    };
                    const suivantHandler = () => {
                        precedent.style.visibility = 'visible';
                        if (index_path_affiché + 1 < allPaths.length) {
                            index_path_affiché += 1;
                            if (index_path_affiché + 1 == allPaths.length) {
                                suivant.style.visibility = 'hidden';
                            }
                        }
                        afficherCheminCourant();
                    };
                    precedent.onclick = precedentHandler;
                    suivant.onclick = suivantHandler;
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
                        const generalSelects = document.querySelectorAll("#questionsGenerales select");
                        let allGeneralAnswered = true;
                        generalSelects.forEach(select => {
                            const questionWrapper = select.parentElement;
                            questionWrapper.style.color = "";
                            if (!select.value || select.value === "-- Select an answer --") {
                                allGeneralAnswered = false;
                                questionWrapper.style.color = "red";
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
                                .then(data => {
                                    alert("Réponses envoyées avec succès !");
                                })
                                .catch(error => {
                                    alert("Erreur lors de l’envoi des réponses.");
                                });
                        } else {
                            alert("Merci de répondre à toutes les questions.");
                        }
                    });
                })
                .catch(err => {
                    hideLoader(); // ⬅️ En cas d'erreur, on enlève aussi le loader
                    alert("Erreur lors de la récupération du cours aléatoire.");
                });

            // ➡️ Chargement du top 5 (pas de loader ici pour ne pas bloquer l’UI)
            fetch(`http://localhost:5000/api/top5?user=${user}&course=${course}`)
                .then(response => response.json())
                .then(data => {
                    document.getElementById("messageTop5").innerText = "";
                    if (Object.keys(data).length == 0) {
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
            hideLoader(); // ⬅️ Si l’appel random_course échoue
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
});

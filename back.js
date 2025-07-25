

var nodes = [
    { id: 0, label: "user_191.0", group: 0 },
    { id: 1, label: "course_513", group: 1 },
    { id: 2, label: "in-process", group: 2 },
    { id: 3, label: "course_1992", group: 1 },
];
var edges = [
    { from: 0, to: 1, label: "HighInterest" },
    { from: 1, to: 2, label: "HasKnowledgeTopic" },
    { from: 2, to: 3, label: "isKnowledgeTopicOf" },
];

// create a network
var container = document.getElementById("graph");
var data = {
    nodes: nodes,
    edges: edges,
};
var options = {
    nodes: {
        shape: "dot",
        size: 30,
        font: {
            size: 32,
            color: "#ffffff",
        },
        borderWidth: 2,
    },
    edges: {
        width: 2,
    },
};

network = new vis.Network(container, data, options);















async function loadPath() {
    const start = document.getElementById("user").value;
    const end = document.getElementById("course").value;

    const response = await fetch(`http://localhost:5000/api/path?start=${start}&end=${end}`);
    const data = await response.json();

    const nodes = data.nodes.map(id => ({ id, label: id }));
    const edges = data.edges.map(e => ({
        from: e.from,
        to: e.to,
        label: e.label,
        arrows: "to"
    }));

    const network = new vis.Network(
        document.getElementById("graph"),
        { nodes, edges },
        {
            edges: { font: { align: "top" }, arrows: "to" },
            nodes: { font: { color: "white" } }
        }
    );
}
  




///////////
fetch("mon_graphe.json")
            .then(res => res.json())
            .then(data => {
                var options = {
    nodes: {
        shape: "dot",
        size: 30,
        font: {
            size: 32,
            color: "#ffffff",
        },
        borderWidth: 2,
    },
    edges: {
        width: 2,
    },
};

                const network = new vis.Network(
                    document.getElementById("graph"),
                    data,
                    options
                );
            });
        


            /////////////////////
fetch(`http://localhost:5000/api/pathETvoisins?start=${user}&end=${course}&end=${nodeId}`)
                            .then(res => res.json())
                            .then(data => {
                                const options = {
                                    nodes: {
                                        shape: "dot",
                                        size: 30,
                                        font: { size: 32, color: "#ffffff" },
                                        borderWidth: 2,
                                    },
                                    edges: {
                                        width: 2,
                                        font: { align: "top", color: "#ffffff" }
                                    },
                                };

                                const container = document.getElementById("graph");
                                new vis.Network(container, data, options);

                            });
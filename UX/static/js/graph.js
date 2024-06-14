const width = 960;
const height = 600;
const radius = 20;

const svg = d3.select("svg")
    .attr("width", width)
    .attr("height", height);

const color = d3.scaleOrdinal(d3.schemeCategory10);

const simulation = d3.forceSimulation()
    .force("link", d3.forceLink().id(d => d.method_nm).distance(100))
    .force("charge", d3.forceManyBody().strength(-200))
    .force("center", d3.forceCenter(width / 2, height / 2));

// Define arrow markers for graph links
svg.append("defs").selectAll("marker")
    .data(["end"])
    .enter().append("marker")
    .attr("id", d => d)
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 25)
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", "#999");

Promise.all([
    d3.json("/data/nodes"),
    d3.json("/data/links")
]).then(([nodes, links]) => {
    const linkData = [];
    links.forEach(link => {
        link.global_uses.forEach(target => {
            linkData.push({ source: link.method_nm, target: target });
        });
    });

    const link = svg.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(linkData)
        .enter().append("line")
        .attr("class", "link")
        .attr("stroke-width", 2)
        .attr("stroke", "#ff5733") // Set link color
        .attr("marker-end", "url(#end)"); // Add arrow marker

    const node = svg.append("g")
        .attr("class", "nodes")
        .selectAll("circle")
        .data(nodes)
        .enter().append("circle")
        .attr("class", "node")
        .attr("r", radius)
        .attr("fill", d => color(d.method_nm))
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended))
        .on("click", handleClick);

    node.append("title")
        .text(d => d.method_nm);

    simulation
        .nodes(nodes)
        .on("tick", ticked);

    simulation.force("link")
        .links(linkData);

    function ticked() {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);
    }

    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    function handleClick(event, d) {
        const sidebar = document.getElementById("sidebar");
        const details = document.getElementById("details");
        details.textContent = JSON.stringify(d, null, 2);
        sidebar.style.display = "block";
    }
});


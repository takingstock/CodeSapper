const width = 960;
const height = 600;
const rectWidth = 200;
const rectHeight = 50;
const padding = 10; // Padding for the rectangles

const svg = d3.select("svg")
    .attr("width", width)
    .attr("height", height);

const color = d3.scaleOrdinal()
    .domain(["source", "globalUse"])
    .range(["green", "orange"]);

// Define arrow markers for graph links
svg.append("defs").selectAll("marker")
    .data(["end"])
    .enter().append("marker")
    .attr("id", d => d)
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 15) // Adjusted refX for better visibility
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", "#999");

const urlParams = new URLSearchParams(window.location.search);
const vizId = urlParams.get('viz_id');

if (vizId) {
    Promise.all([
        d3.json(`/data/nodes/${vizId}`).then(data => {
            console.log('Nodes:', data);  // Log the nodes data
            return data;
        }),
        d3.json(`/data/links/${vizId}`).then(data => {
            console.log('Links:', data);  // Log the links data
            return data;
        })
    ]).then(([nodes, links]) => {
        if (!nodes || !links) {
            throw new Error('Missing nodes or links data');
        }

        // Log the received data
        console.log('Received nodes:', nodes);
        console.log('Received links:', links);

        // Set initial positions for nodes
        const sourceNode = nodes[0]; // Assuming the first node is the source
        const globalUseNodes = nodes.slice(1); // All other nodes are global uses

        sourceNode.x = width / 4;
        sourceNode.y = height / 2;

        const ySpacing = height / (globalUseNodes.length + 1);
        globalUseNodes.forEach((node, index) => {
            node.x = width * 0.75;
            node.y = (index + 1) * ySpacing;
        });

        // Process links data
        const linkData = [];
        links.forEach(link => {
            if (link.global_uses_) {
                link.global_uses_.forEach((target, i) => {
                    const source = sourceNode;
                    const targetNode = globalUseNodes.find(node => node.method_nm === target);
                    if (targetNode) {
                        linkData.push({ 
                            source: source, 
                            target: targetNode,
                            impacted_code_snippet: link.impacted_code_snippet[i] || '' 
                        });
                    }
                });
            }
        });

        console.log('Processed link data:', linkData);  // Log the processed link data

        const link = svg.append("g")
            .attr("class", "links")
            .selectAll("path")
            .data(linkData)
            .enter().append("path")
            .attr("class", "link")
            .attr("stroke-width", 2)
            .attr("stroke", "#ff5733") // Set link color
            .attr("marker-end", "url(#end)"); // Add arrow marker

        const linkText = svg.append("g")
            .attr("class", "link-text")
            .selectAll("text")
            .data(linkData)
            .enter().append("text")
            .attr("class", "link-label")
            .attr("fill", "#000")
            .attr("font-size", "10px")
            .text(d => d.impacted_code_snippet);

        const node = svg.append("g")
            .attr("class", "nodes")
            .selectAll("g")
            .data(nodes)
            .enter().append("g")
            .attr("class", "node")
            .attr("transform", d => `translate(${d.x},${d.y})`) // Initialize node positions
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended))
            .on("click", handleClick);

        node.each(function(d) {
            const methodTextLength = getTextWidth(d.method_nm, "12px Arial");
            const fileTextLength = getTextWidth(d.fnm, "12px Arial");
            d.rectWidth = ( 2 * Math.max(methodTextLength, fileTextLength) ) + ( 2 * padding );
        });

        node.filter(d => d === sourceNode)
            .append("rect")
            .attr("width", d => d.rectWidth)
            .attr("height", rectHeight)
            .attr("fill", d => color("source"))
            .attr("stroke", "#000");

        node.filter(d => d !== sourceNode)
            .append("rect")
            .attr("width", d => d.rectWidth)
            .attr("height", rectHeight)
            .attr("fill", d => color("globalUse"))
            .attr("stroke", "#000");

        node.append("text")
            .attr("x", d => d.rectWidth / 2)
            .attr("y", rectHeight / 4)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", "#fff")
            .text(d => d.fnm);

        node.append("text")
            .attr("x", d => d.rectWidth / 2)
            .attr("y", 3 * rectHeight / 4)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", "#fff")
            .text(d => d.method_nm);

        const simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(linkData).id(d => d.method_nm).distance(200))
            .force("charge", d3.forceManyBody().strength(-200))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .on("tick", ticked);

        function ticked() {
            link.attr("d", function(d) {
                const deltaX = d.target.x - d.source.x;
                const deltaY = d.target.y - d.source.y;
                const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                const normX = deltaX / dist;
                const normY = deltaY / dist;
                const sourcePadding = rectWidth / 2;
                const targetPadding = rectWidth / 2 + 10;
                const sourceX = d.source.x + (sourcePadding * normX);
                const sourceY = d.source.y + (rectHeight / 2) * normY;
                const targetX = d.target.x - (targetPadding * normX);
                const targetY = d.target.y - (rectHeight / 2) * normY;
                return `M${sourceX},${sourceY} C${(sourceX + targetX) / 2},${sourceY} ${(sourceX + targetX) / 2},${targetY} ${targetX},${targetY}`;
            });

            linkText
                .attr("x", d => (d.source.x + d.target.x) / 2)
                .attr("y", d => (d.source.y + d.target.y) / 2);

            node.attr("transform", d => `translate(${d.x - d.rectWidth / 2},${d.y - rectHeight / 2})`);
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
    }).catch(error => {
        console.error('Error loading data:', error);
    });
} else {
    console.error('No viz_id specified in URL parameters');
}

// Helper function to calculate the width of the text
function getTextWidth(text, font) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    context.font = font;
    return context.measureText(text).width;
}


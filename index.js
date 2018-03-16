'use strict';

const _ = require('lodash');
const Viz = require('viz.js');

let groupName = name => 'cluster_' + name.toLowerCase().replace(/[^a-z0-9]+/g, '_');

let nodeId = name => 'r' + name.toLowerCase().replace(/[^a-z0-9]+/g, '_');

let attr = attribs => attribs && Object.keys(attribs).length ?
    ' [ ' + Object.keys(attribs).map(v => v + '=' + JSON.stringify(attribs[v])).join('; ') + ' ]'
    : '';

class Nodes {
    constructor(options) {
        this.allNodes = {};
        this.groups = {};
        this.external = {};
        this.edges = [];
        this.options = _.defaults(options, {
            node: { shape: 'box3d' },
            edge: { fontsize: 7, color: 'black' },
            groupNode: { shape: 'rectangle' },
            missingNode: { shape: 'rectangle' },
            groupEdge: { color: 'black' },
            fromStyle: 'stroke: red; stroke-width: 4px;',
            toStyle: 'stroke: green; stroke-width: 4px;',
            css: '.node { cursor: pointer; }'
        });
    }

    node(name, attribs) {
        attribs = attribs || {};
        let nodes = this.external;
        let group = attribs.group;
        if (group) {
            if (!this.groups[group]) this.groups[group] = {};
            nodes = this.groups[group];
        }
        let id = nodeId(name);
        if (!attribs.label) attribs.label = name;
        attribs.id = id;
        nodes[id] = attribs;
        this.allNodes[id] = attribs;
        return attribs;
    }

    edge(fromName, toName, attribs) {
        let fromId = nodeId(fromName);
        let toId = nodeId(toName);
        let edge = { fromId, fromName, toId, toName, attribs };
        this.edges.push(edge);
        return edge;
    }

    generateMissingNodes() {
        _.each(this.edges, edge => {
            if (!this.allNodes[edge.fromId]) this.node(edge.fromName, _.clone(this.options.missingNode));
            if (!this.allNodes[edge.toId]) this.node(edge.toName, _.clone(this.options.missingNode));
        });
    }

    drawNode(id, attribs) {
        attribs = attribs || {};
        attribs.href = 'javascript:(function(){document.getElementById(\'g\').setAttribute(\'class\', \'graph ' + id + '\')})()';
        return '    ' + id + attr(attribs) + ';\n';
    }

    drawEdge(edge) {
        edge.attribs = edge.attribs || {};
        edge.attribs.edgetooltip = edge.fromName + ' -&gt; ' + edge.toName;
        edge.attribs.id = 'f_' + edge.fromId + ' t_' + edge.toId;
        return '  ' + edge.fromId + ' -> ' + edge.toId + attr(edge.attribs) + ';\n';
    }

    dot() {
        // Create digraph G
        let g = 'digraph G  {\n';
        g += '  id="g";\n';
        g += '  stylesheet="map.css";\n';
        g += '  rankdir="LR";\n';
        if (this.options.name) g += '  label=' + JSON.stringify(this.options.name) + ';\n';
        if (this.options.node)
            g += '  node' + attr(this.options.node) + ';\n';
        if (this.options.edge)
            g += '  edge' + attr(this.options.edge) + ';\n\n';

        // draw groups and items
        _.each(this.groups, (group, name) => {
            g += '  subgraph ' + groupName(name) + '  {\n';
            g += '    color=blue;\n';
            g += '    label=' + JSON.stringify(name) + ';\n';
            if (this.options.groupNode)
                g += '    node' + attr(this.options.groupNode) + ';\n';
            if (this.options.groupEdge)
                g += '    edge' + attr(this.options.groupEdge) + ';\n';

            _.each(group, (node, id) => g += this.drawNode(id, node));

            g += '  }\n\n';
        });

        // draw external items
        _.each(this.external, (node, id) => g += this.drawNode(id, node));

        g += '\n';

        // draw edges
        _.each(this.edges, edge => g += this.drawEdge(edge));

        g += '}\n';

        return g;
    }

    style() {
        let froms = [];
        let tos = [];

        _.each(this.groups, (group) => {
            _.each(group, (node, id) => {
                froms.push('#g.' + id + ' [id~=f_' + id + '] path');
                tos.push('#g.' + id + ' [id~=t_' + id + '] path');
            });
        });

        // draw external items
        _.each(this.external, (node, id) => {
            froms.push('#g.' + id + ' [id~=f_' + id + '] path');
            tos.push('#g.' + id + ' [id~=t_' + id + '] path');
        });

        return froms.join(',\n') + '{' + this.options.fromStyle + '}\n\n' +
            tos.join(',\n') + '{' + this.options.toStyle + '}\n\n' +
            this.options.css + '\n';
    }

    svg() {
        this.generateMissingNodes();
        let dot = this.dot();
        let svg = Viz(dot);
        let css = this.style();
        let style = '<defs><style type="text/css"><![CDATA[\n' + css + '\n]]></style></defs>\n';
        svg = svg.replace(/(<svg[^>]*>)/, '$1' + style);
        return svg;
    }
}

module.exports = Nodes;

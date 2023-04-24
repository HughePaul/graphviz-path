'use strict';

const _ = require('lodash');
const Viz = require('viz.js');
Viz.render = require('viz.js/full.render.js');

let groupName = (name, cluster = true) => (cluster ? 'cluster_' : 'group_') + name.toLowerCase().replace(/[^a-z0-9]+/g, '_');

let nodeId = name => 'r' + name.toLowerCase().replace(/[^a-z0-9]+/g, '_');

let stringify = v => typeof v === 'string' ? v.startsWith('<<') ? v : JSON.stringify(v).replace(/\\\\l/g, '\\l') : JSON.stringify(v);

let attr = attribs => attribs && Object.keys(attribs).length ?
    Object.keys(attribs).map(v => v + '=' + stringify(attribs[v]) + ';').join(' ')
    : '';

let nodeAttr = attribs => {
    let attrText = attr(attribs);
    return attrText ? ' [ ' + attrText + ' ]' : '';
};

class Nodes {
    constructor(options) {
        options = options || {};
        this.allNodes = {};
        this.groups = {};
        this.external = {};
        this.edges = [];
        this.options = {
            sameRank: options.sameRank || [],
            graph: _.extend({ id: 'g', rankdir: 'LR' }, options.graph),
            group: _.extend({ color: 'blue' }, options.group),
            node: _.extend({ shape: 'box3d' }, options.node),
            edge: _.extend({ fontsize: 7, color: 'black' }, options.edge),
            groupNode: _.extend({ shape: 'rectangle' }, options.graphNode),
            missingNode: _.extend({ shape: 'rectangle' }, options.missingNode),
            groupEdge: _.extend({ color: 'black' }, options.groupEdge),
            fromStyle: options.fromStyle || 'stroke: red; stroke-width: 4px;',
            toStyle: options.toStyle || 'stroke: green; stroke-width: 4px;',
            css: options.css || '.node { cursor: pointer; }'
        };
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

    removeUnconnectedNodes() {
        let usedNodes = _.uniq(_.map(this.edges, 'fromId').concat(_.map(this.edges, 'toId')));
        let allNodes = Object.keys(this.allNodes);
        let unusedNodes = _.difference(allNodes, usedNodes);
        for (let id of unusedNodes) {
            let node = this.allNodes[id];
            let group = this.groups[node.attribs && node.attribs.group] || this.external;
            delete group[id];
            delete this.allNodes[id];
        }
    }

    drawNode(id, attribs) {
        attribs = attribs || {};
        attribs.href = 'javascript:(function(){document.getElementById(\'g\').setAttribute(\'class\', \'graph ' + id + '\')})()';
        return '    ' + id + nodeAttr(attribs) + ';\n';
    }

    drawEdge(edge) {
        edge.attribs = edge.attribs || {};
        edge.attribs.edgetooltip = edge.fromName + ' -&gt; ' + edge.toName;
        edge.attribs.id = 'f_' + edge.fromId + ' t_' + edge.toId;
        return '  ' + edge.fromId + ' -> ' + edge.toId + nodeAttr(edge.attribs) + ';\n';
    }

    dot() {
        // Create digraph G
        let g = 'digraph G  {\n';
        g += '  ' + attr(this.options.graph) + '\n';
        if (this.options.node)
            g += '  node' + nodeAttr(this.options.node) + ';\n';
        if (this.options.edge)
            g += '  edge' + nodeAttr(this.options.edge) + ';\n\n';

        // draw groups and items
        _.each(this.groups, (group, name) => {
            let attributes = _.defaults({ label: name }, this.options.group);
            g += '  subgraph ' + groupName(name) + '  {\n';
            g += '    ' + attr(attributes) + '\n';
            if (this.options.groupNode)
                g += '    node' + nodeAttr(this.options.groupNode) + ';\n';
            if (this.options.groupEdge)
                g += '    edge' + nodeAttr(this.options.groupEdge) + ';\n';

            _.each(group, (node, id) => g += this.drawNode(id, node));

            if (this.options.groupRaw)
                g += '    ' + this.options.groupRaw + '\n';

            g += '  }\n\n';
        });

        // draw external items
        _.each(this.external, (node, id) => g += this.drawNode(id, node));

        g += '\n';

        // draw edges
        _.each(this.edges, edge => g += this.drawEdge(edge));

        if (this.options.raw)
            g += '    ' + this.options.raw + '\n';

        if (this.options.sameRank.length) {
            let attributes = { rank: 'same' };
            g += '  subgraph ' + groupName('SAME_RANK') + '  {\n';
            g += '    ' + attr(attributes) + '\n';
            _.each(this.options.sameRank, id => {
                g += '    ' + nodeId(id) + ';\n';
            });
            g += '  }\n\n';
        }

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
        return new Promise((resolve, reject) => {
            const dot = this.dot();
            const viz = new Viz(Viz.render);
            viz.renderString(dot).then(svg => {
                const css = this.style();
                let style = '<defs><style type="text/css"><![CDATA[\n' + css + '\n]]></style></defs>\n';
                svg = svg.replace(/(<svg[^>]*>)/, '$1' + style);
                resolve(svg);
            }).catch(reject);
        });
    }
}

module.exports = Nodes;

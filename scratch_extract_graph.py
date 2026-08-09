import json

with open('graphify-out/graph.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

nodes = {n['id']: n for n in data['nodes']}
links = data.get('links', [])

# Also check hyperedges if any
# group by relation
relations = {}
for link in links:
    rel = link.get('relation', 'unknown')
    relations.setdefault(rel, []).append(link)

print("Relations found:", list(relations.keys()))

with open('scratch_graph_results.md', 'w', encoding='utf-8') as out:
    out.write("# Graphify Workflow & Dependencies\n\n")
    for rel, rlinks in relations.items():
        out.write(f"## {rel}\n")
        for e in rlinks[:100]:  # limit to 100 per relation
            src_node = nodes.get(e['source'], {})
            tgt_node = nodes.get(e['target'], {})
            src = src_node.get('label', e['source'])
            tgt = tgt_node.get('label', e['target'])
            
            # extract community and file for more context
            src_file = src_node.get('source_file', '')
            tgt_file = tgt_node.get('source_file', '')
            
            out.write(f"- `{src}` ({src_file}) -> `{tgt}` ({tgt_file})\n")

import os
import re
from pathlib import Path
from typing import TypedDict, List, Dict, Any
import networkx as nx
import graphviz

# Ensure Graphviz dot executable is in PATH
os.environ["PATH"] += os.pathsep + r"C:\Program Files\Graphviz\bin"

from langgraph.graph import StateGraph, START, END

ROOT = Path(__file__).resolve().parents[1]
REPORTS_DIR = ROOT / "reports"
CODE_GS = ROOT / "Code.gs"

class FunctionData(TypedDict):
    name: str
    args: str
    returns: List[str]
    calls: List[str]
    body: str

class AgentState(TypedDict):
    functions: Dict[str, FunctionData]
    nx_graph: Any  # nx.DiGraph

def extract_functions(state: AgentState):
    functions = {}
    if CODE_GS.exists():
        text = CODE_GS.read_text(encoding="utf-8", errors="replace")
        
        # Split codebase by "function " to isolate bodies
        parts = text.split("\nfunction ")
        
        # Handle the very first line if the file starts exactly with "function "
        if text.startswith("function "):
            parts[0] = text.split("\nfunction ")[0]
            
        for i, part in enumerate(parts):
            if i == 0 and not text.startswith("function "): 
                continue
                
            match = re.match(r"^([A-Za-z_$][\w$]*)\s*\((.*?)\)\s*\{", part)
            if match:
                name = match.group(1)
                args = match.group(2).strip()
                body = part[match.end():]
                
                # Try to extract return statements
                returns = list(set(re.findall(r"\breturn\s+(.*?);", body)))
                # Clean up overly long returns
                returns = [r[:40] + '...' if len(r) > 40 else r for r in returns]
                
                functions[name] = {
                    "name": name,
                    "args": args,
                    "returns": returns,
                    "calls": [],
                    "body": body
                }
    return {"functions": functions}

def analyze_dependencies(state: AgentState):
    functions = state.get("functions", {})
    all_func_names = set(functions.keys())
    
    for name, data in functions.items():
        body = data["body"]
        # Find calls to other functions
        for other_func in all_func_names:
            if other_func != name:
                if re.search(r"\b" + re.escape(other_func) + r"\s*\(", body):
                    data["calls"].append(other_func)
                    
    return {"functions": functions}

def build_graph(state: AgentState):
    functions = state.get("functions", {})
    G = nx.DiGraph()
    
    for name, data in functions.items():
        args_str = data["args"] if data["args"] else "none"
        ret_str = ", ".join(data["returns"]) if data["returns"] else "void"
        label = f"{name}\nIn: ({args_str})\nOut: {ret_str}"
        G.add_node(name, label=label)
        
    for name, data in functions.items():
        for call in data["calls"]:
            G.add_edge(name, call)
            
    return {"nx_graph": G}

def render_graphviz(state: AgentState):
    G = state.get("nx_graph")
    if not G:
        return {}
        
    dot = graphviz.Digraph(comment="Architecture Map")
    dot.attr(rankdir='LR', size='12,8')
    dot.attr('node', shape='box', style='filled', color='lightblue', fontname='Helvetica', fontsize='10')
    
    for node, attrs in G.nodes(data=True):
        dot.node(node, attrs.get('label', node))
        
    for u, v in G.edges():
        dot.edge(u, v)
        
    REPORTS_DIR.mkdir(exist_ok=True)
    out_path = REPORTS_DIR / "architecture_map"
    
    # Save the raw .gv dot file and SVG
    dot.render(out_path, format="svg", cleanup=False)
    dot.render(out_path, format="png", cleanup=False)
    print(f"Generated {out_path}.svg and {out_path}.png")
    return {}

def main():
    print("Starting Architecture Mapping with LangGraph, NetworkX, and Graphviz...")
    workflow = StateGraph(AgentState)
    
    workflow.add_node("extractor", extract_functions)
    workflow.add_node("analyzer", analyze_dependencies)
    workflow.add_node("builder", build_graph)
    workflow.add_node("renderer", render_graphviz)
    
    workflow.add_edge(START, "extractor")
    workflow.add_edge("extractor", "analyzer")
    workflow.add_edge("analyzer", "builder")
    workflow.add_edge("builder", "renderer")
    workflow.add_edge("renderer", END)
    
    app = workflow.compile()
    
    # Run the graph
    app.invoke({"functions": {}, "nx_graph": nx.DiGraph()})
    print("Done!")

if __name__ == "__main__":
    main()

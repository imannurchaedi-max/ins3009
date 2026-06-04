import os
import re
from pathlib import Path
from typing import TypedDict, List, Dict, Any
import networkx as nx
import graphviz
from langgraph.graph import StateGraph, START, END

# Ensure Graphviz dot executable is in PATH
os.environ["PATH"] += os.pathsep + r"C:\Program Files\Graphviz\bin"

ROOT = Path(__file__).resolve().parents[1]
REPORTS_DIR = ROOT / "reports"

class FunctionData(TypedDict):
    name: str
    args: str
    returns: List[str]
    calls: List[str]
    layer: str  # "backend" or "frontend"
    body: str

class AgentState(TypedDict):
    functions: Dict[str, FunctionData]
    nx_graph: Any  # nx.DiGraph

def extract_functions(state: AgentState):
    functions = {}
    
    # 1. Extract Backend (Code.js / Code.gs)
    for ext in ["*.gs", "*.js"]:
        for path in (ROOT / "active").rglob(ext):
            if path.name.lower() in ["code.js", "code.gs"]:
                text = path.read_text(encoding="utf-8", errors="replace")
                
                parts = text.split("\nfunction ")
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
                        
                        returns = list(set(re.findall(r"\breturn\s+(.*?);", body)))
                        returns = [r[:40] + '...' if len(r) > 40 else r for r in returns]
                        
                        functions[name] = {
                            "name": name,
                            "args": args,
                            "returns": returns,
                            "calls": [],
                            "layer": "backend",
                            "body": body
                        }
                        
    # 2. Extract Frontend (*.html)
    for path in (ROOT / "active").rglob("*.html"):
        text = path.read_text(encoding="utf-8", errors="replace")
        
        # Match standard functions: function foo(a, b) {
        func_iter = re.finditer(r"\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\((.*?)\)\s*\{", text)
        for match in func_iter:
            name = match.group(1)
            args = match.group(2).strip()
            start_idx = match.end()
            # grab up to 3000 chars as body approximation for dependency search
            body = text[start_idx:start_idx+3000] 
            
            returns = list(set(re.findall(r"\breturn\s+(.*?);", body)))
            returns = [r[:40] + '...' if len(r) > 40 else r for r in returns]
            
            functions[name] = {
                "name": name, "args": args, "returns": returns,
                "calls": [], "layer": "frontend", "body": body
            }
            
        # Match arrow functions: const foo = async (a, b) => {
        arrow_iter = re.finditer(r"\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\((.*?)\)\s*=>\s*\{", text)
        for match in arrow_iter:
            name = match.group(1)
            args = match.group(2).strip()
            start_idx = match.end()
            body = text[start_idx:start_idx+3000]
            
            returns = list(set(re.findall(r"\breturn\s+(.*?);", body)))
            returns = [r[:40] + '...' if len(r) > 40 else r for r in returns]
            
            functions[name] = {
                "name": name, "args": args, "returns": returns,
                "calls": [], "layer": "frontend", "body": body
            }

    print(f"Extracted {len([f for f in functions.values() if f['layer'] == 'backend'])} backend functions.")
    print(f"Extracted {len([f for f in functions.values() if f['layer'] == 'frontend'])} frontend functions.")
    return {"functions": functions}

def analyze_dependencies(state: AgentState):
    functions = state.get("functions", {})
    all_func_names = set(functions.keys())
    
    for name, data in functions.items():
        body = data["body"]
        
        # 1. Normal function calls
        for other_func in all_func_names:
            if other_func != name:
                # Basic string matching for function calls
                if re.search(r"\b" + re.escape(other_func) + r"\s*\(", body):
                    data["calls"].append(other_func)
                    
        # 2. google.script.run calls (frontend calling backend)
        if data["layer"] == "frontend":
            # Looks for google.script.run...methodName(
            # e.g., google.script.run.withSuccessHandler(cb).verifyLogin(a,b)
            gsr_matches = re.finditer(r"google\.script\.run(?:[.\w\s()]*?)\.([A-Za-z_$][\w$]*)\s*\(", body)
            for m in gsr_matches:
                backend_func = m.group(1)
                # Ensure we only link to actual backend functions
                if backend_func in all_func_names and functions[backend_func]["layer"] == "backend":
                    data["calls"].append(backend_func)
                    
        # deduplicate
        data["calls"] = list(set(data["calls"]))
        
    return {"functions": functions}

def build_graph(state: AgentState):
    functions = state.get("functions", {})
    G = nx.DiGraph()
    
    for name, data in functions.items():
        args_str = data["args"] if data["args"] else "none"
        ret_str = ", ".join(data["returns"]) if data["returns"] else "void"
        # Wrap long lines slightly
        if len(ret_str) > 50:
            ret_str = ret_str[:47] + "..."
            
        layer = data["layer"]
        label = f"{name}\nIn: ({args_str})\nOut: {ret_str}"
        G.add_node(name, label=label, layer=layer)
        
    for name, data in functions.items():
        for call in data["calls"]:
            if call in G:
                G.add_edge(name, call)
            
    return {"nx_graph": G}

def render_graphviz(state: AgentState):
    G = state.get("nx_graph")
    if not G:
        return {}
        
    dot = graphviz.Digraph(comment="Full Architecture Map")
    dot.attr(rankdir='LR', size='24,16')
    dot.attr('node', fontname='Helvetica', fontsize='10')
    dot.attr('edge', color='gray60', arrowsize='0.7')
    
    for node, attrs in G.nodes(data=True):
        layer = attrs.get("layer", "backend")
        
        if layer == "backend":
            color = "lightblue"
            shape = "box"
            style = "filled,rounded"
        else:
            color = "lightgreen"
            shape = "ellipse"
            style = "filled"
            
        dot.node(node, attrs.get('label', node), shape=shape, style=style, fillcolor=color)
        
    for u, v in G.edges():
        dot.edge(u, v)
        
    REPORTS_DIR.mkdir(exist_ok=True)
    out_path = REPORTS_DIR / "full_architecture_map"
    
    dot.render(out_path, format="svg", cleanup=False)
    dot.render(out_path, format="png", cleanup=False)
    print(f"Generated Map: {out_path}.svg and {out_path}.png")
    return {}

def main():
    print("Starting Full Architecture Mapping with LangGraph, NetworkX, and Graphviz...")
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
    app.invoke({"functions": {}, "nx_graph": nx.DiGraph()})
    print("Done!")

if __name__ == "__main__":
    main()

"""
Run all 5 node instances (a, b, c, d, e) in parallel
Each runs with its own config from the unified config.py
"""

import subprocess
import sys
import time
import os

def run_node_instance(node_id):
    """Run a single node instance with specified node_id"""
    cmd = [sys.executable, "run_node.py", node_id]
    return subprocess.Popen(
        cmd,
        cwd=os.path.dirname(os.path.abspath(__file__))
    )

def main():
    """Start all 5 node instances"""
    node_ids = ['a', 'b', 'c', 'd', 'e']
    processes = []
    
    print("🌐 Starting 5 traffic nodes...")
    print("=" * 50)
    
    for nid in node_ids:
        try:
            p = run_node_instance(nid)
            processes.append((nid, p))
            print(f"✅ Started node {nid}")
            time.sleep(0.5)  # Stagger startup
        except Exception as e:
            print(f"❌ Failed to start node {nid}: {e}")
    
    print("=" * 50)
    print(f"🎯 Running {len(processes)} node instances")
    print("   - Node A on port 9001")
    print("   - Node B on port 9002")
    print("   - Node C on port 9003")
    print("   - Node D on port 9004")
    print("   - Node E on port 9005")
    print("\nPress Ctrl+C to stop all")
    print("=" * 50)
    
    try:
        while True:
            time.sleep(1)
            # Check if any process died
            for nid, p in processes:
                if p.poll() is not None:
                    print(f"⚠️  node {nid} died with code {p.returncode}")
    except KeyboardInterrupt:
        print("\n\n🛑 Stopping all nodes...")
        for nid, p in processes:
            try:
                p.terminate()
                p.wait(timeout=2)
                print(f"✅ Stopped node {nid}")
            except:
                p.kill()
                print(f"❌ Killed node {nid}")

if __name__ == "__main__":
    main()

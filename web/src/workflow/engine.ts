/**
 * Workflow 引擎
 * Day 6: 状态机驱动的节点编排
 */

import type { WorkflowNode, WorkflowState } from "./types.js";

/** 执行工作流 */
export async function runWorkflow(
  startNode: WorkflowNode,
  state: WorkflowState
): Promise<WorkflowState> {
  let currentNode: WorkflowNode | null = startNode;

  console.log(`\n🔄 Workflow 启动: ${startNode.name}`);
  console.log(`-`.repeat(40));

  while (currentNode && state.iteration < state.maxIterations) {
    state.iteration++;
    state.nodeHistory.push(currentNode.name);

    console.log(`\n📍 节点 ${state.iteration}: ${currentNode.name}`);
    console.log(`   ${currentNode.description}`);

    // 执行节点
    state = await currentNode.execute(state);

    // 决定下一个节点
    const nextName = currentNode.next(state);
    if (!nextName) {
      console.log(`\n✅ Workflow 完成`);
      break;
    }

    currentNode = findNode(nextName);
    if (!currentNode) {
      console.log(`\n❌ 节点 "${nextName}" 不存在，Workflow 中断`);
      break;
    }
  }

  if (state.iteration >= state.maxIterations) {
    console.log(`\n⚠️ 达到最大迭代次数`);
    state.finalAnswer = "Workflow 执行次数过多，请简化问题。";
  }

  return state;
}

/** 节点注册表 */
const nodeRegistry = new Map<string, WorkflowNode>();

/** 注册节点 */
export function registerNode(node: WorkflowNode): void {
  nodeRegistry.set(node.name, node);
}

/** 查找节点 */
export function findNode(name: string): WorkflowNode | null {
  return nodeRegistry.get(name) || null;
}

/** 获取所有已注册节点 */
export function getAllNodes(): WorkflowNode[] {
  return Array.from(nodeRegistry.values());
}

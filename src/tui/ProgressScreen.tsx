import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EventManager } from "../core/event-manager.js";
import type { ConceptNode } from "../core/types.js";
import { formatLog } from "../utils/logger.js";

interface ProgressScreenProps {
	events: EventManager;
	sessionTopic?: string;
	onQuit?: () => void;
}

interface FlattenedNode {
	id: string;
	name: string;
	status: ConceptNode["status"];
	depth: number;
	hasChildren: boolean;
	currentStep?: string;
	stepStatus?: string;
	startTime?: number;
}

type TabType = "tree" | "tasks" | "logs";

export const ProgressScreen: React.FC<ProgressScreenProps> = ({
	events,
	sessionTopic,
	onQuit,
}) => {
	const [phase, setPhase] = useState("Initializing...");
	const [currentNodeName, setCurrentNodeName] = useState<string | null>(null);
	const [logs, setLogs] = useState<string[]>([]);
	const [nodes, setNodes] = useState<Map<string, ConceptNode>>(new Map());
	const [nodeTree, setNodeTree] = useState<Map<string, string[]>>(new Map());
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
	const [nodeSteps, setNodeSteps] = useState<
		Map<string, { step: string; status: string }>
	>(new Map());
	const [nodeStartTimes, setNodeStartTimes] = useState<Map<string, number>>(
		new Map(),
	);
	const [activeTab, setActiveTab] = useState<TabType>("tree");
	const [logScrollOffset, setLogScrollOffset] = useState(0);
	const [isTailing, setIsTailing] = useState(true);
	const [taskScrollOffset, setTaskScrollOffset] = useState(0);

	const addLog = useCallback((msg: string) => {
		setLogs((prev) => [...prev, msg]);
	}, []);

	// Refs to hold current values for useInput callback (avoids stale closures)
	const visibleNodesRef = useRef<FlattenedNode[]>([]);
	const selectedIndexRef = useRef(0);
	const activeTabRef = useRef<TabType>("tree");
	const logsRef = useRef<string[]>([]);
	const isTailingRef = useRef(true);

	// Check if all descendants of a node are done
	const areAllChildrenDone = useCallback(
		(nodeId: string): boolean => {
			const children = nodeTree.get(nodeId) || [];
			if (children.length === 0) return true;

			for (const childId of children) {
				const childNode = nodes.get(childId);
				if (!childNode || childNode.status !== "done") {
					return false;
				}
				if (!areAllChildrenDone(childId)) {
					return false;
				}
			}
			return true;
		},
		[nodeTree, nodes],
	);

	// Get effective status for display (considers children status)
	const getEffectiveStatus = useCallback(
		(nodeId: string, originalStatus: ConceptNode["status"]): ConceptNode["status"] => {
			if (originalStatus !== "done") return originalStatus;

			const children = nodeTree.get(nodeId) || [];
			if (children.length === 0) return "done";

			// If marked as done but has incomplete children, show as in-progress
			if (!areAllChildrenDone(nodeId)) {
				return "in-progress";
			}
			return "done";
		},
		[nodeTree, areAllChildrenDone],
	);

	// Build flattened visible nodes (respecting collapse state)
	const visibleNodes = useMemo(() => {
		const result: FlattenedNode[] = [];

		// Find all child node IDs
		const childIds = new Set<string>();
		for (const children of nodeTree.values()) {
			for (const childId of children) {
				childIds.add(childId);
			}
		}

		// Root nodes are nodes that are not children of any other node
		const rootIds = Array.from(nodes.keys()).filter((id) => !childIds.has(id));

		const traverse = (id: string, depth: number, parentCollapsed: boolean) => {
			if (parentCollapsed) return;
			const node = nodes.get(id);
			if (!node) return;

			const children = nodeTree.get(id) || [];
			const hasChildren = children.length > 0;
			const isCollapsed = collapsedNodes.has(id);
			const stepInfo = nodeSteps.get(id);
			const startTime = nodeStartTimes.get(id);

			result.push({
				id,
				name: node.name,
				status: getEffectiveStatus(id, node.status),
				depth,
				hasChildren,
				currentStep: stepInfo?.step,
				stepStatus: stepInfo?.status,
				startTime,
			});

			for (const childId of children) {
				traverse(childId, depth + 1, isCollapsed);
			}
		};

		// Traverse from all root nodes
		for (const rootId of rootIds) {
			traverse(rootId, 0, false);
		}

		return result;
	}, [nodes, nodeTree, collapsedNodes, nodeSteps, nodeStartTimes, getEffectiveStatus]);

	// Get pending and in-progress tasks
	const pendingTasks = useMemo(() => {
		const tasks: Array<{ id: string; name: string; status: ConceptNode["status"]; step?: string }> = [];
		for (const [id, node] of nodes) {
			const effectiveStatus = getEffectiveStatus(id, node.status);
			if (effectiveStatus === "pending" || effectiveStatus === "in-progress") {
				const stepInfo = nodeSteps.get(id);
				tasks.push({
					id,
					name: node.name,
					status: effectiveStatus,
					step: stepInfo?.step,
				});
			}
		}
		// Sort: in-progress first, then pending
		return tasks.sort((a, b) => {
			if (a.status === "in-progress" && b.status !== "in-progress") return -1;
			if (a.status !== "in-progress" && b.status === "in-progress") return 1;
			return 0;
		});
	}, [nodes, nodeSteps, getEffectiveStatus]);

	// Keep refs in sync with current values
	visibleNodesRef.current = visibleNodes;
	selectedIndexRef.current = selectedIndex;
	activeTabRef.current = activeTab;
	logsRef.current = logs;
	isTailingRef.current = isTailing;

	// Clamp selected index when visible nodes change
	useEffect(() => {
		if (visibleNodes.length > 0 && selectedIndex >= visibleNodes.length) {
			setSelectedIndex(visibleNodes.length - 1);
		}
	}, [visibleNodes.length, selectedIndex]);

	// Auto-scroll logs to bottom when new logs arrive (always when tailing is on)
	const LOG_WINDOW_SIZE = 12;
	const TASK_WINDOW_SIZE = 10;
	useEffect(() => {
		if (isTailing) {
			const maxOffset = Math.max(0, logs.length - LOG_WINDOW_SIZE);
			setLogScrollOffset(maxOffset);
		}
	}, [logs.length, isTailing]);

	// Subscribe to EventManager topics
	useEffect(() => {
		// Subscribe to log topic
		const unsubLog = events.subscribe("log", (event) => {
			if (event.type === "entry") {
				const formatted = formatLog(event.level, event.message, event.args);
				addLog(formatted);
			}
		});

		// Subscribe to node topic
		const unsubNode = events.subscribe("node", (event) => {
			if (event.type === "discovered") {
				const { node, parentId } = event;
				if (!node) return;
				setNodes((prev) => {
					const next = new Map(prev);
					next.set(node.id, node);
					return next;
				});
				setNodeStartTimes((prev) => {
					const next = new Map(prev);
					next.set(node.id, Date.now());
					return next;
				});
				if (parentId) {
					setNodeTree((prev) => {
						const next = new Map(prev);
						const children = next.get(parentId) || [];
						if (!children.includes(node.id)) {
							next.set(parentId, [...children, node.id]);
						}
						return next;
					});
				}
			} else if (event.type === "status_update") {
				const { nodeId, status } = event;
				if (!nodeId) return;
				setNodes((prev) => {
					const node = prev.get(nodeId);
					if (!node) return prev;
					const next = new Map(prev);
					next.set(nodeId, { ...node, status });
					return next;
				});
				// Update current node name when status changes to in-progress
				if (status === "in-progress") {
					const node = nodes.get(nodeId);
					if (node) {
						setCurrentNodeName(node.name);
					}
				}
			}
		});

		// Subscribe to workflow topic
		const unsubWorkflow = events.subscribe("workflow", (event) => {
			if (event.type === "phase_start") {
				setPhase(event.phase.toUpperCase());
				addLog(`>>> Phase: ${event.phase}`);
			} else if (event.type === "step_progress") {
				const { nodeId, step, status, message } = event;
				if (nodeId) {
					setNodeSteps((prev) => {
						const next = new Map(prev);
						next.set(nodeId, { step, status });
						return next;
					});
					// Update current node name when we get step progress
					const node = nodes.get(nodeId);
					if (node) {
						setCurrentNodeName(node.name);
					}
				}
				if (message) addLog(`  - ${message}`);
			}
		});

		// Subscribe to error topic
		const unsubError = events.subscribe("error", (event) => {
			if (event.type === "error") {
				addLog(`ERROR: ${event.message}`);
			}
		});

		return () => {
			unsubLog();
			unsubNode();
			unsubWorkflow();
			unsubError();
		};
	}, [events, addLog, nodes]);

	useInput((input, key) => {
		// Quit with Ctrl+C or q
		if ((key.ctrl && input === "c") || input === "q") {
			if (onQuit) {
				onQuit();
			}
			return;
		}

		// Tab switching with Tab key or number keys 1/2/3
		if (key.tab || input === "1" || input === "2" || input === "3") {
			if (input === "1") {
				setActiveTab("tree");
			} else if (input === "2") {
				setActiveTab("tasks");
			} else if (input === "3") {
				setActiveTab("logs");
			} else {
				// Cycle through tabs
				setActiveTab((prev) => {
					if (prev === "tree") return "tasks";
					if (prev === "tasks") return "logs";
					return "tree";
				});
			}
			return;
		}

		const currentTab = activeTabRef.current;

		// Handle navigation based on active tab
		if (currentTab === "tree") {
			const currentNodes = visibleNodesRef.current;
			const currentIndex = selectedIndexRef.current;

			if (key.upArrow) {
				setSelectedIndex((prev) => Math.max(0, prev - 1));
			}
			if (key.downArrow) {
				setSelectedIndex((prev) => Math.min(currentNodes.length - 1, prev + 1));
			}
			if (key.leftArrow) {
				const node = currentNodes[currentIndex];
				if (node?.hasChildren) {
					setCollapsedNodes((prev) => new Set(prev).add(node.id));
				}
			}
			if (key.rightArrow) {
				const node = currentNodes[currentIndex];
				if (node) {
					setCollapsedNodes((prev) => {
						const next = new Set(prev);
						next.delete(node.id);
						return next;
					});
				}
			}
			if (input === " " || key.return) {
				const node = currentNodes[currentIndex];
				if (node?.hasChildren) {
					setCollapsedNodes((prev) => {
						const next = new Set(prev);
						if (next.has(node.id)) {
							next.delete(node.id);
						} else {
							next.add(node.id);
						}
						return next;
					});
				}
			}
		} else if (currentTab === "tasks") {
			// Tasks tab navigation
			const maxOffset = Math.max(0, pendingTasks.length - TASK_WINDOW_SIZE);
			if (key.upArrow) {
				setTaskScrollOffset((prev) => Math.max(0, prev - 1));
			}
			if (key.downArrow) {
				setTaskScrollOffset((prev) => Math.min(maxOffset, prev + 1));
			}
		} else {
			// Logs tab controls
			const currentLogs = logsRef.current;
			const maxOffset = Math.max(0, currentLogs.length - LOG_WINDOW_SIZE);

			// Toggle tailing with 'f' (follow)
			if (input === "f") {
				setIsTailing((prev) => !prev);
				return;
			}

			// Jump to bottom and resume tailing with 'g' (go to end)
			if (input === "g") {
				setLogScrollOffset(maxOffset);
				setIsTailing(true);
				return;
			}

			// Arrow navigation only when NOT tailing
			if (!isTailingRef.current) {
				if (key.upArrow) {
					setLogScrollOffset((prev) => Math.max(0, prev - 1));
				}
				if (key.downArrow) {
					setLogScrollOffset((prev) => Math.min(maxOffset, prev + 1));
				}
			}
		}
	});

	const getStatusIcon = (status: ConceptNode["status"]) => {
		switch (status) {
			case "done":
				return <Text color="green">✓</Text>;
			case "in-progress":
				return (
					<Text color="yellow">
						<Spinner type="dots" />
					</Text>
				);
			case "failed":
				return <Text color="red">✗</Text>;
			default:
				return <Text color="gray">○</Text>;
		}
	};

	const getCollapseIcon = (node: FlattenedNode) => {
		if (!node.hasChildren) return "•";
		return collapsedNodes.has(node.id) ? "▶" : "▼";
	};

	const formatElapsed = (startTime?: number) => {
		if (!startTime) return "";
		const elapsed = Math.floor((Date.now() - startTime) / 1000);
		return `(${elapsed}s)`;
	};

	const formatStepInfo = (node: FlattenedNode) => {
		if (!node.currentStep) return "";
		if (node.stepStatus === "completed") return "";
		return `[${node.currentStep}...]`;
	};

	// Calculate visible window for tree view
	const treeWindowSize = 10;
	const halfWindow = Math.floor(treeWindowSize / 2);
	let startIdx = Math.max(0, selectedIndex - halfWindow);
	const endIdx = Math.min(visibleNodes.length, startIdx + treeWindowSize);
	if (endIdx - startIdx < treeWindowSize) {
		startIdx = Math.max(0, endIdx - treeWindowSize);
	}
	const windowedNodes = visibleNodes.slice(startIdx, endIdx);

	// Calculate visible window for logs
	const visibleLogs = logs.slice(
		logScrollOffset,
		logScrollOffset + LOG_WINDOW_SIZE,
	);

	// Calculate visible window for tasks
	const visibleTasks = pendingTasks.slice(
		taskScrollOffset,
		taskScrollOffset + TASK_WINDOW_SIZE,
	);

	// Format the phase display with current node name
	const getPhaseDisplay = () => {
		if (currentNodeName) {
			return `${phase}: ${currentNodeName}`;
		}
		return phase;
	};

	const renderTreeTab = () => (
		<Box
			flexDirection="column"
			flexGrow={1}
			borderStyle="single"
			borderColor={activeTab === "tree" ? "cyan" : "gray"}
			paddingX={1}
		>
			{visibleNodes.length === 0 ? (
				<Text color="gray">Discovering concepts...</Text>
			) : (
				windowedNodes.map((node, i) => {
					const actualIndex = startIdx + i;
					const isSelected = actualIndex === selectedIndex;
					return (
						<Box key={node.id}>
							<Text color={isSelected ? "cyan" : "white"}>
								{isSelected ? "> " : "  "}
								{"  ".repeat(node.depth)}
								{getCollapseIcon(node)} {getStatusIcon(node.status)} {node.name}{" "}
								<Text color="gray">
									{formatStepInfo(node)} {formatElapsed(node.startTime)}
								</Text>
							</Text>
						</Box>
					);
				})
			)}
			{visibleNodes.length > treeWindowSize && (
				<Text color="gray" dimColor>
					{startIdx > 0 ? "↑ more above" : ""}{" "}
					{endIdx < visibleNodes.length ? "↓ more below" : ""}
				</Text>
			)}
		</Box>
	);

	const renderTasksTab = () => (
		<Box
			flexDirection="column"
			flexGrow={1}
			borderStyle="single"
			borderColor={activeTab === "tasks" ? "cyan" : "gray"}
			paddingX={1}
		>
			{pendingTasks.length === 0 ? (
				<Text color="gray">No pending tasks...</Text>
			) : (
				visibleTasks.map((task) => (
					<Box key={task.id}>
						<Text>
							{getStatusIcon(task.status)}{" "}
							<Text color={task.status === "in-progress" ? "yellow" : "white"}>
								{task.name}
							</Text>
							{task.step && (
								<Text color="gray"> [{task.step}...]</Text>
							)}
						</Text>
					</Box>
				))
			)}
			{pendingTasks.length > TASK_WINDOW_SIZE && (
				<Box justifyContent="space-between">
					<Text color="gray" dimColor>
						{taskScrollOffset > 0 ? "↑ more above" : ""}{" "}
						{taskScrollOffset + TASK_WINDOW_SIZE < pendingTasks.length ? "↓ more below" : ""}
					</Text>
					<Text color="gray" dimColor>
						{pendingTasks.length} tasks
					</Text>
				</Box>
			)}
		</Box>
	);

	const renderLogsTab = () => (
		<Box
			flexDirection="column"
			flexGrow={1}
			borderStyle="single"
			borderColor={activeTab === "logs" ? "cyan" : "gray"}
			paddingX={1}
		>
			{logs.length === 0 ? (
				<Text color="gray">No logs yet...</Text>
			) : (
				visibleLogs.map((log, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: log tail order is stable
					<Text key={logScrollOffset + i} color="gray" wrap="truncate-end">
						{log}
					</Text>
				))
			)}
			{logs.length > 0 && (
				<Box justifyContent="space-between">
					<Text color="gray" dimColor>
						{logs.length > LOG_WINDOW_SIZE
							? `${logScrollOffset + 1}-${Math.min(logScrollOffset + LOG_WINDOW_SIZE, logs.length)} of ${logs.length}`
							: `${logs.length} lines`}
					</Text>
					<Text color={isTailing ? "green" : "yellow"} dimColor>
						{isTailing ? "● TAILING" : "○ PAUSED"}
					</Text>
				</Box>
			)}
		</Box>
	);

	const getHelpText = () => {
		switch (activeTab) {
			case "tree":
				return "1/2/3/Tab: switch │ ↑↓: navigate │ ←→/Enter: toggle";
			case "tasks":
				return "1/2/3/Tab: switch │ ↑↓: scroll";
			case "logs":
				return "1/2/3/Tab: switch │ f: toggle tail │ g: go to end │ ↑↓: scroll (when paused)";
		}
	};

	return (
		<Box
			flexDirection="column"
			padding={1}
			borderStyle="round"
			borderColor="yellow"
			minHeight={20}
		>
			{/* Session header */}
			{sessionTopic && (
				<Box marginBottom={1}>
					<Text bold color="cyan">
						Session: {sessionTopic}
					</Text>
					<Text color="gray"> │ [q] Quit</Text>
				</Box>
			)}

			{/* Header with phase and help */}
			<Box justifyContent="space-between">
				<Box>
					<Text color="green">
						<Spinner type="dots" />{" "}
					</Text>
					<Text bold color="white">
						{" "}
						{getPhaseDisplay()}
					</Text>
				</Box>
				<Text color="gray">{getHelpText()}</Text>
			</Box>

			{/* Tab bar */}
			<Box marginY={1}>
				<Text
					color={activeTab === "tree" ? "cyan" : "gray"}
					bold={activeTab === "tree"}
				>
					[1:Tree ({visibleNodes.length})]
				</Text>
				<Text> </Text>
				<Text
					color={activeTab === "tasks" ? "cyan" : "gray"}
					bold={activeTab === "tasks"}
				>
					[2:Tasks ({pendingTasks.length})]
				</Text>
				<Text> </Text>
				<Text
					color={activeTab === "logs" ? "cyan" : "gray"}
					bold={activeTab === "logs"}
				>
					[3:Logs ({logs.length})]
				</Text>
			</Box>

			{/* Tab content */}
			{activeTab === "tree" && renderTreeTab()}
			{activeTab === "tasks" && renderTasksTab()}
			{activeTab === "logs" && renderLogsTab()}
		</Box>
	);
};

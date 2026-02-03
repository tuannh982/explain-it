import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EventSystem } from "../core/events.js";
import type { ConceptNode } from "../core/types.js";
import { logEvents } from "../utils/logger.js";

interface ProgressScreenProps {
	events: EventSystem;
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

type TabType = "tree" | "logs";

export const ProgressScreen: React.FC<ProgressScreenProps> = ({ events }) => {
	const [phase, setPhase] = useState("Initializing...");
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

	const addLog = useCallback((msg: string) => {
		setLogs((prev) => [...prev, msg]);
	}, []);

	// Refs to hold current values for useInput callback (avoids stale closures)
	const visibleNodesRef = useRef<FlattenedNode[]>([]);
	const selectedIndexRef = useRef(0);

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
				status: node.status,
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
	}, [nodes, nodeTree, collapsedNodes, nodeSteps, nodeStartTimes]);

	// Keep refs in sync with current values
	visibleNodesRef.current = visibleNodes;
	selectedIndexRef.current = selectedIndex;

	// Clamp selected index when visible nodes change
	useEffect(() => {
		if (visibleNodes.length > 0 && selectedIndex >= visibleNodes.length) {
			setSelectedIndex(visibleNodes.length - 1);
		}
	}, [visibleNodes.length, selectedIndex]);

	// Auto-scroll logs to bottom when new logs arrive (only if already near bottom)
	const LOG_WINDOW_SIZE = 12;
	useEffect(() => {
		const maxOffset = Math.max(0, logs.length - LOG_WINDOW_SIZE);
		// Auto-scroll if we're within 3 lines of the bottom
		if (logScrollOffset >= maxOffset - 3 || logs.length <= LOG_WINDOW_SIZE) {
			setLogScrollOffset(maxOffset);
		}
	}, [logs.length, logScrollOffset]);

	useEffect(() => {
		const handlePhaseStart = (p: { phase: string }) => {
			setPhase(p.phase.toUpperCase());
			addLog(`>>> Phase: ${p.phase}`);
		};

		const handleStepProgress = (p: {
			nodeId: string;
			step: string;
			status: string;
			message?: string;
		}) => {
			const { nodeId, step, status, message } = p;
			if (nodeId) {
				setNodeSteps((prev) => {
					const next = new Map(prev);
					next.set(nodeId, { step, status });
					return next;
				});
			}
			if (message) addLog(`  - ${message}`);
		};

		const handleNodeDiscovered = (p: {
			node: ConceptNode;
			parentId?: string;
		}) => {
			const { node, parentId } = p;
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
		};

		const handleNodeStatusUpdate = (p: {
			nodeId: string;
			status: ConceptNode["status"];
		}) => {
			const { nodeId, status } = p;
			if (!nodeId) return;
			setNodes((prev) => {
				const node = prev.get(nodeId);
				if (!node) return prev;
				const next = new Map(prev);
				next.set(nodeId, { ...node, status });
				return next;
			});
		};

		const handleError = (p: { message: string }) => {
			addLog(`ERROR: ${p.message}`);
		};

		events.on("phase_start", handlePhaseStart);
		events.on("step_progress", handleStepProgress);
		events.on("node_discovered", handleNodeDiscovered);
		events.on("node_status_update", handleNodeStatusUpdate);
		events.on("error", handleError);

		return () => {
			events.off("phase_start", handlePhaseStart);
			events.off("step_progress", handleStepProgress);
			events.off("node_discovered", handleNodeDiscovered);
			events.off("node_status_update", handleNodeStatusUpdate);
			events.off("error", handleError);
		};
	}, [events, addLog]);

	// Subscribe to logger events
	useEffect(() => {
		const handleLog = (entry: { level: string; formatted: string }) => {
			addLog(entry.formatted);
		};
		logEvents.on("log", handleLog);
		return () => {
			logEvents.off("log", handleLog);
		};
	}, [addLog]);

	useInput((input, key) => {
		// Tab switching with Tab key
		if (key.tab) {
			setActiveTab((prev) => (prev === "tree" ? "logs" : "tree"));
			return;
		}

		// Handle navigation based on active tab
		if (activeTab === "tree") {
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
		} else {
			// Logs tab navigation
			const maxOffset = Math.max(0, logs.length - LOG_WINDOW_SIZE);
			if (key.upArrow) {
				setLogScrollOffset((prev) => Math.max(0, prev - 1));
			}
			if (key.downArrow) {
				setLogScrollOffset((prev) => Math.min(maxOffset, prev + 1));
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
			{logs.length > LOG_WINDOW_SIZE && (
				<Text color="gray" dimColor>
					Showing {logScrollOffset + 1}-
					{Math.min(logScrollOffset + LOG_WINDOW_SIZE, logs.length)} of{" "}
					{logs.length}
				</Text>
			)}
		</Box>
	);

	return (
		<Box
			flexDirection="column"
			padding={1}
			borderStyle="round"
			borderColor="yellow"
			height={20}
		>
			{/* Header with phase and help */}
			<Box justifyContent="space-between">
				<Box>
					<Text color="green">
						<Spinner type="dots" />{" "}
					</Text>
					<Text bold color="white">
						{" "}
						{phase}
					</Text>
				</Box>
				<Text color="gray">Tab: switch │ ↑↓: navigate │ ←→/Enter: toggle</Text>
			</Box>

			{/* Tab bar */}
			<Box marginY={1}>
				<Text
					color={activeTab === "tree" ? "cyan" : "gray"}
					bold={activeTab === "tree"}
				>
					[Tree]
				</Text>
				<Text> </Text>
				<Text
					color={activeTab === "logs" ? "cyan" : "gray"}
					bold={activeTab === "logs"}
				>
					[Logs ({logs.length})]
				</Text>
			</Box>

			{/* Tab content */}
			{activeTab === "tree" ? renderTreeTab() : renderLogsTab()}
		</Box>
	);
};

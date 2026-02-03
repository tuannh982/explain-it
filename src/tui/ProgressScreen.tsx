import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
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

export const ProgressScreen: React.FC<ProgressScreenProps> = ({ events }) => {
	const [phase, setPhase] = useState("Initializing...");
	const [logs, setLogs] = useState<string[]>([]);
	const [nodes, setNodes] = useState<Map<string, ConceptNode>>(new Map());
	const [nodeTree, setNodeTree] = useState<Map<string, string[]>>(new Map());
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
	const [nodeSteps, setNodeSteps] = useState<Map<string, { step: string; status: string }>>(new Map());
	const [nodeStartTimes, setNodeStartTimes] = useState<Map<string, number>>(new Map());

	const addLog = useCallback((msg: string) => {
		setLogs((prev) => [...prev.slice(-4), msg]);
	}, []);

	// Build flattened visible nodes (respecting collapse state)
	const visibleNodes = useMemo(() => {
		const result: FlattenedNode[] = [];
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
		traverse("root", 0, false);
		return result;
	}, [nodes, nodeTree, collapsedNodes, nodeSteps, nodeStartTimes]);

	useEffect(() => {
		const handlePhaseStart = (p: { phase: string }) => {
			setPhase(p.phase.toUpperCase());
			addLog(`>>> Phase: ${p.phase}`);
		};

		const handleStepProgress = (p: { nodeId: string; step: string; status: string; message?: string }) => {
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

		const handleNodeDiscovered = (p: { node: ConceptNode; parentId?: string }) => {
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

		const handleNodeStatusUpdate = (p: { nodeId: string; status: ConceptNode["status"] }) => {
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
		if (key.upArrow) {
			setSelectedIndex((prev) => Math.max(0, prev - 1));
		}
		if (key.downArrow) {
			setSelectedIndex((prev) => Math.min(visibleNodes.length - 1, prev + 1));
		}
		if (key.leftArrow) {
			const node = visibleNodes[selectedIndex];
			if (node?.hasChildren) {
				setCollapsedNodes((prev) => new Set(prev).add(node.id));
			}
		}
		if (key.rightArrow) {
			const node = visibleNodes[selectedIndex];
			if (node) {
				setCollapsedNodes((prev) => {
					const next = new Set(prev);
					next.delete(node.id);
					return next;
				});
			}
		}
		if (input === " " || key.return) {
			const node = visibleNodes[selectedIndex];
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

	// Calculate visible window
	const windowSize = 8;
	const halfWindow = Math.floor(windowSize / 2);
	let startIdx = Math.max(0, selectedIndex - halfWindow);
	const endIdx = Math.min(visibleNodes.length, startIdx + windowSize);
	if (endIdx - startIdx < windowSize) {
		startIdx = Math.max(0, endIdx - windowSize);
	}
	const windowedNodes = visibleNodes.slice(startIdx, endIdx);

	return (
		<Box
			flexDirection="column"
			padding={1}
			borderStyle="round"
			borderColor="yellow"
			height={20}
		>
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
				<Text color="gray">↑↓ navigate │ ←→/Enter toggle</Text>
			</Box>

			<Box
				flexDirection="column"
				marginY={1}
				flexGrow={1}
				borderStyle="single"
				borderColor="blue"
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
			</Box>

			<Box
				flexDirection="column"
				borderStyle="single"
				borderColor="gray"
				paddingX={1}
				height={5}
			>
				<Text color="white" bold>Logs:</Text>
				{logs.map((log, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: log tail order is stable
					<Text key={i} color="gray" wrap="truncate-end">
						{log}
					</Text>
				))}
			</Box>
		</Box>
	);
};

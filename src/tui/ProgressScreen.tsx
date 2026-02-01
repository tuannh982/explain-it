import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { EventSystem } from "../core/events.js";
import type { ConceptNode } from "../core/types.js";

interface ProgressScreenProps {
	events: EventSystem;
}

interface FlattenedNode {
	id: string;
	name: string;
	status: ConceptNode["status"];
	depth: number;
}

export const ProgressScreen: React.FC<ProgressScreenProps> = ({ events }) => {
	const [phase, setPhase] = useState("Initializing...");
	const [logs, setLogs] = useState<string[]>([]);
	const [currentStep, setCurrentStep] = useState("");
	const [nodes, setNodes] = useState<Map<string, ConceptNode>>(new Map());
	const [nodeTree, setNodeTree] = useState<Map<string, string[]>>(new Map()); // parentId -> childIds[]
	const [selectedIndex, setSelectedIndex] = useState(0);

	const addLog = useCallback((msg: string) => {
		setLogs((prev) => [...prev.slice(-5), msg]); // Keep last 5 logs for tree space
	}, []);

	const flattenedNodes = useMemo(() => {
		const result: FlattenedNode[] = [];
		const traverse = (id: string, depth: number) => {
			const node = nodes.get(id);
			if (!node) return;
			result.push({ id, name: node.name, status: node.status, depth });
			const children = nodeTree.get(id) || [];
			children.forEach((childId) => {
				traverse(childId, depth + 1);
			});
		};
		traverse("root", 0);
		return result;
	}, [nodes, nodeTree]);

	useEffect(() => {
		events.on("phase_start", (p: any) => {
			setPhase((p as { phase?: string }).phase?.toUpperCase() || "UNKNOWN");
			addLog(`>>> Phase: ${(p as { phase?: string }).phase}`);
		});

		events.on("step_progress", (p: any) => {
			const msg = (p as { message?: string }).message;
			setCurrentStep(msg || "");
			if (msg) addLog(`  - ${msg}`);
		});

		events.on("node_discovered", (p: any) => {
			// biome-ignore lint/suspicious/noExplicitAny: complex payload
			const { node, parentId } = (p as any).data || {};
			if (!node) return;
			setNodes((prev) => {
				const next = new Map(prev);
				next.set(node.id, node);
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
		});

		events.on("node_status_update", (p: any) => {
			// biome-ignore lint/suspicious/noExplicitAny: complex payload
			const { nodeId, status } = (p as any).data || {};
			if (!nodeId) return;
			setNodes((prev) => {
				const node = prev.get(nodeId);
				if (!node) return prev;
				const next = new Map(prev);
				next.set(nodeId, { ...node, status });
				return next;
			});
		});

		events.on("error", (p: any) => {
			addLog(`ERROR: ${(p as { message?: string }).message}`);
		});
	}, [events, addLog]);

	useInput((_input, key) => {
		if (key.upArrow) {
			setSelectedIndex((prev) => Math.max(0, prev - 1));
		}
		if (key.downArrow) {
			setSelectedIndex((prev) => Math.min(flattenedNodes.length - 1, prev + 1));
		}
	});

	const getStatusIcon = (status: ConceptNode["status"]) => {
		switch (status) {
			case "done":
				return <Text color="green">✅</Text>;
			case "in-progress":
				return (
					<Text color="yellow">
						<Spinner type="dots" />
					</Text>
				);
			case "failed":
				return <Text color="red">❌</Text>;
			default:
				return <Text color="gray">⏳</Text>;
		}
	};

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
				<Text color="gray">Use ↑↓ to browse</Text>
			</Box>

			<Box
				flexDirection="column"
				marginY={1}
				flexGrow={1}
				borderStyle="single"
				borderColor="blue"
				paddingX={1}
			>
				{flattenedNodes.length === 0 ? (
					<Text color="gray">Discovering concepts...</Text>
				) : (
					flattenedNodes
						.map((node, i) => (
							<Box key={node.id}>
								<Text color={i === selectedIndex ? "cyan" : "white"}>
									{i === selectedIndex ? "> " : "  "}
									{"  ".repeat(node.depth)}
									{getStatusIcon(node.status)} {node.name}
								</Text>
							</Box>
						))
						.slice(Math.max(0, selectedIndex - 5), selectedIndex + 5)
				)}
			</Box>

			{currentStep && (
				<Box marginBottom={1}>
					<Text color="blue">Activity: {currentStep}</Text>
				</Box>
			)}

			<Box
				flexDirection="column"
				borderStyle="single"
				borderColor="gray"
				paddingX={1}
			>
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

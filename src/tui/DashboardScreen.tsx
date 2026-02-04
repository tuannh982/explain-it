// src/tui/DashboardScreen.tsx
import { Box, Text, useInput } from "ink";
import { useState } from "react";
import type { Session } from "../core/session-types.js";

interface Props {
	activeSessions: Session[];
	archivedSessions: Session[];
	onSelectSession: (session: Session) => void;
	onNewSession: () => void;
	onQuit: () => void;
}

function formatTimeAgo(isoString: string): string {
	const date = new Date(isoString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMins / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffMins < 1) return "just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	return `${diffDays}d ago`;
}

function getStatusIcon(status: Session["status"]): string {
	switch (status) {
		case "running":
			return "▶";
		case "completed":
			return "✓";
		case "failed":
			return "✗";
		case "interrupted":
			return "⏸";
		default:
			return "?";
	}
}

function getStatusColor(status: Session["status"]): string {
	switch (status) {
		case "running":
			return "cyan";
		case "completed":
			return "green";
		case "failed":
			return "red";
		case "interrupted":
			return "yellow";
		default:
			return "white";
	}
}

export const DashboardScreen = ({
	activeSessions,
	archivedSessions,
	onSelectSession,
	onNewSession,
	onQuit,
}: Props) => {
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [section, setSection] = useState<"active" | "history">("active");

	const currentList = section === "active" ? activeSessions : archivedSessions;
	const maxIndex = currentList.length - 1;

	useInput((input, key) => {
		if (input === "n" || input === "+") {
			onNewSession();
			return;
		}

		if (input === "q") {
			onQuit();
			return;
		}

		if (key.tab) {
			setSection(section === "active" ? "history" : "active");
			setSelectedIndex(0);
			return;
		}

		if (key.upArrow && selectedIndex > 0) {
			setSelectedIndex(selectedIndex - 1);
		}

		if (key.downArrow && selectedIndex < maxIndex) {
			setSelectedIndex(selectedIndex + 1);
		}

		if (key.return && currentList.length > 0) {
			onSelectSession(currentList[selectedIndex]);
		}

		// Number keys for quick select (1-9)
		const num = Number.parseInt(input, 10);
		if (num >= 1 && num <= 9 && num <= currentList.length) {
			onSelectSession(currentList[num - 1]);
		}
	});

	return (
		<Box flexDirection="column" padding={1}>
			<Box marginBottom={1}>
				<Text bold color="cyan">
					explain-it Sessions
				</Text>
			</Box>

			{/* Active Sessions */}
			<Box flexDirection="column" marginBottom={1}>
				<Text bold underline color={section === "active" ? "white" : "gray"}>
					Active Sessions {section === "active" ? "◀" : ""}
				</Text>
				{activeSessions.length === 0 ? (
					<Text color="gray" dimColor>
						No active sessions
					</Text>
				) : (
					activeSessions.map((session, i) => (
						<Box key={session.id}>
							<Text
								color={
									section === "active" && i === selectedIndex ? "cyan" : "white"
								}
								inverse={section === "active" && i === selectedIndex}
							>
								[{i + 1}]{" "}
								<Text color={getStatusColor(session.status)}>
									{getStatusIcon(session.status)}
								</Text>{" "}
								{session.topic.substring(0, 30).padEnd(30)}{" "}
								<Text color="gray">{session.folderName}</Text>
							</Text>
						</Box>
					))
				)}
			</Box>

			{/* History */}
			<Box flexDirection="column" marginBottom={1}>
				<Text bold underline color={section === "history" ? "white" : "gray"}>
					History {section === "history" ? "◀" : ""}
				</Text>
				{archivedSessions.length === 0 ? (
					<Text color="gray" dimColor>
						No archived sessions
					</Text>
				) : (
					archivedSessions.slice(0, 5).map((session, i) => (
						<Box key={session.id}>
							<Text
								color={
									section === "history" && i === selectedIndex ? "cyan" : "gray"
								}
								inverse={section === "history" && i === selectedIndex}
							>
								[h{i + 1}]{" "}
								<Text color={getStatusColor(session.status)}>
									{getStatusIcon(session.status)}
								</Text>{" "}
								{session.topic.substring(0, 25).padEnd(25)}{" "}
								{formatTimeAgo(session.completedAt || session.createdAt)}
							</Text>
						</Box>
					))
				)}
			</Box>

			{/* Help */}
			<Box borderStyle="single" borderColor="gray" paddingX={1}>
				<Text color="gray">
					[n] New Session [↑↓] Navigate [Tab] Switch Section [Enter] View [q]
					Quit
				</Text>
			</Box>
		</Box>
	);
};

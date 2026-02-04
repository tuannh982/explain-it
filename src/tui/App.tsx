import { Box, Text, useApp } from "ink";
import { useState } from "react";
import { config } from "../config/config.js";
import { Orchestrator } from "../core/orchestrator.js";
import { ErrorScreen } from "./ErrorScreen.js";
import { InputScreen, type UserInput } from "./InputScreen.js";
import { OutputScreen } from "./OutputScreen.js";
import { ProgressScreen } from "./ProgressScreen.js";

type Screen = "input" | "progress" | "output" | "error";

export const App = () => {
	const { exit } = useApp();

	const [screen, setScreen] = useState<Screen>("input");
	const [orchestrator, setOrchestrator] = useState<Orchestrator | null>(null);
	const [outputPath, setOutputPath] = useState<string>("");
	const [sessionTopic, setSessionTopic] = useState<string>("");
	const [error, setError] = useState<Error | null>(null);
	const [sessionStatus, setSessionStatus] = useState<"completed" | "failed">(
		"completed",
	);

	const handleStartSession = async (input: UserInput) => {
		try {
			// Generate a unique session folder name
			const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
			const sanitizedTopic = input.query
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.slice(0, 30);
			const folderName = `${sanitizedTopic}-${timestamp}`;
			const folderPath = `${config.paths.output}/${folderName}`;

			setOutputPath(folderPath);
			setSessionTopic(input.query);

			// Create orchestrator for this session
			const newOrchestrator = new Orchestrator(folderName, folderPath);
			setOrchestrator(newOrchestrator);

			// Show progress screen
			setScreen("progress");

			// Start processing in background after a brief delay to ensure
			// ProgressScreen has mounted and subscribed to events
			setTimeout(() => {
				newOrchestrator
					.process(input.query, input.depth, input.persona)
					.then(() => {
						setSessionStatus("completed");
						setScreen("output");
					})
					.catch((err: unknown) => {
						setSessionStatus("failed");
						setError(err instanceof Error ? err : new Error(String(err)));
						setScreen("error");
					});
			}, 0);
		} catch (err: unknown) {
			setError(err instanceof Error ? err : new Error(String(err)));
			setScreen("error");
		}
	};

	const handleQuit = () => {
		if (orchestrator) {
			orchestrator.markInterrupted();
		}
		exit();
	};

	return (
		<Box flexDirection="column">
			{screen === "input" && (
				<InputScreen
					onSubmit={handleStartSession}
					orchestrator={new Orchestrator("temp", config.paths.root)}
				/>
			)}
			{screen === "progress" && orchestrator && (
				<ProgressScreen
					events={orchestrator.getEvents()}
					sessionTopic={sessionTopic}
					onQuit={handleQuit}
				/>
			)}
			{screen === "output" && (
				<OutputScreen
					outputPath={outputPath}
					sessionStatus={sessionStatus}
					onQuit={handleQuit}
				/>
			)}
			{screen === "error" && error && <ErrorScreen error={error} />}
		</Box>
	);
};

import { Box } from "ink";
import { useEffect, useState } from "react";
import { config } from "../config/config.js";
import { Orchestrator } from "../core/orchestrator.js";
import { ErrorScreen } from "./ErrorScreen.js";
import { InputScreen, type UserInput } from "./InputScreen.js";
import { OutputScreen } from "./OutputScreen.js";
import { ProgressScreen } from "./ProgressScreen.js";

export const App = () => {
	const [screen, setScreen] = useState<
		"input" | "progress" | "output" | "error" | "clarification"
	>("input");
	const [orchestrator] = useState(() => new Orchestrator(config.paths.output));
	const [outputDir, setOutputDir] = useState("");
	const [error, setError] = useState<Error | null>(null);
	useEffect(() => {
		// Global event listeners can go here if needed
		// For now, InputScreen handles input requests locally
	}, []);

	// State to track the flow
	const [currentTopic, _setCurrentTopic] = useState("");
	// Suggested depth now handled inside InputScreen, but if we want to reset or something, we might keep it.
	// For this refactor, InputScreen manages it locally after clarification.
	const [inputStep, _setInputStep] = useState(0);

	const handleStart = async (input: UserInput) => {
		setScreen("progress");
		try {
			await orchestrator.process(input.query, input.depth, input.persona);
			setOutputDir(config.paths.output);
			setScreen("output");
		} catch (err: unknown) {
			setError(err instanceof Error ? err : new Error(String(err)));
			setScreen("error");
		}
	};

	return (
		<Box flexDirection="column">
			{screen === "input" && (
				<InputScreen
					onSubmit={handleStart}
					initialStep={inputStep}
					initialQuery={currentTopic} // Still useful if we want to pre-fill from somewhere else
					orchestrator={orchestrator}
				/>
			)}
			{screen === "progress" && (
				<ProgressScreen events={orchestrator.getEvents()} />
			)}
			{screen === "output" && <OutputScreen outputPath={outputDir} />}
			{screen === "error" && error && <ErrorScreen error={error} />}
		</Box>
	);
};

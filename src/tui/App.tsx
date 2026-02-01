import { Box } from "ink";
import { useEffect, useState } from "react";
import { config } from "../config/config.js";
import type { EventPayload } from "../core/events.js";
import { Orchestrator } from "../core/orchestrator.js";
import { ClarificationScreen } from "./ClarificationScreen.js";
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
	const [clarificationData, setClarificationData] = useState<{
		question: string;
		options?: string[];
	} | null>(null);

	useEffect(() => {
		const events = orchestrator.getEvents();
		const handleRequestInput = (payload: EventPayload) => {
			if (payload.question) {
				setClarificationData({
					question: payload.question,
					options: payload.options,
				});
				setScreen("clarification");
			}
		};

		events.on("request_input", handleRequestInput);

		return () => {
			// events.off('request_input', handleRequestInput);
		};
	}, [orchestrator]);

	// The handleStart function is now redundant if orchestrator.start() is called automatically on mount.
	// However, if the intention is to still allow user input to trigger a *new* start,
	// this function would need to be re-evaluated.
	// For now, assuming the automatic start replaces the initial user-triggered start.
	// If the orchestrator needs to be restarted with user input, the logic would need adjustment.
	const handleStart = async (input: UserInput) => {
		setScreen("progress");
		try {
			await orchestrator.start(input.query);
			setOutputDir(config.paths.output);
			setScreen("output");
		} catch (err: unknown) {
			setError(err instanceof Error ? err : new Error(String(err)));
			setScreen("error");
		}
	};

	const handleClarificationSubmit = (answer: string) => {
		setScreen("progress");
		setClarificationData(null);
		orchestrator.resolveInput(answer);
	};

	return (
		<Box flexDirection="column">
			{screen === "input" && <InputScreen onSubmit={handleStart} />}
			{screen === "progress" && (
				<ProgressScreen events={orchestrator.getEvents()} />
			)}
			{screen === "clarification" && clarificationData && (
				<ClarificationScreen
					question={clarificationData.question}
					options={clarificationData.options}
					onSubmit={handleClarificationSubmit}
				/>
			)}
			{screen === "output" && <OutputScreen outputPath={outputDir} />}
			{screen === "error" && error && <ErrorScreen error={error} />}
		</Box>
	);
};

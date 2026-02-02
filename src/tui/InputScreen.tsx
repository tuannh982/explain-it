import { Box, Text } from "ink";
import BigText from "ink-big-text";
import Gradient from "ink-gradient";
import SelectInput from "ink-select-input";
import Spinner from "ink-spinner";
import TextInput from "ink-text-input";
import type React from "react";
import { useEffect, useState } from "react";
import type { EventPayload } from "../core/events.js";
import type { Orchestrator } from "../core/orchestrator.js";
import { ClarificationScreen } from "./ClarificationScreen.js";

export type UserInput = {
	query: string;
	depth: number;
	persona: string;
};

export interface InputScreenProps {
	onSubmit: (input: UserInput) => void;
	orchestrator: Orchestrator;
	initialStep?: number;
	initialQuery?: string;
}

export const InputScreen: React.FC<InputScreenProps> = ({
	onSubmit,
	orchestrator,
	initialStep = 0,
	initialQuery = "",
}) => {
	const [query, setQuery] = useState(initialQuery);
	const [step, setStep] = useState(initialStep); // 0 = query, 1 = depth
	const [isLoading, setIsLoading] = useState(false);
	const [statusMessage, setStatusMessage] = useState("");
	const [suggestedDepth, setSuggestedDepth] = useState<number | undefined>(
		undefined,
	);

	// Clarification state
	const [clarificationData, setClarificationData] = useState<{
		question: string;
		options?: string[];
	} | null>(null);

	useEffect(() => {
		const events = orchestrator.getEvents();
		const handleRequestInput = (payload: EventPayload<"request_input">) => {
			if (payload.question) {
				setClarificationData({
					question: payload.question,
					options: payload.options,
				});
				setIsLoading(false); // Stop loading to show input
			}
		};

		events.on("request_input", handleRequestInput);
		return () => {
			events.off("request_input", handleRequestInput);
		};
	}, [orchestrator]);

	const handleQuerySubmit = async (value: string) => {
		if (!value.trim()) return;
		setQuery(value);
		setIsLoading(true);
		setStatusMessage("Clarifying topic...");

		try {
			const clarification = await orchestrator.clarify(value);
			// Update with confirmed topic
			setQuery(clarification.confirmedTopic);
			setSuggestedDepth(clarification.suggestedDepth);

			setIsLoading(false);
			setStep(1); // Move to depth selection
		} catch (error) {
			setIsLoading(false);
			// Ideally handle error here, for now just log text or depend on App error boundary if it throws up
			setStatusMessage(`Error: ${String(error)}`);
		}
	};

	const handleClarificationSubmit = (answer: string) => {
		setClarificationData(null);
		setIsLoading(true); // Resume loading while orchestrator processes answer
		setStatusMessage("Processing answer...");
		orchestrator.resolveInput(answer);
	};

	const handleDepthSelect = (item: {
		value: { depth: number; persona: string };
	}) => {
		onSubmit({
			query,
			depth: item.value.depth,
			persona: item.value.persona,
		});
	};

	const depthOptions = [
		{
			label: "1 - Overview (5-10 mins) [Layman]",
			value: { depth: 1, persona: "Layman" },
		},
		{
			label: "2 - Basics (Get Started) [Novice]",
			value: { depth: 2, persona: "Novice" },
		},
		{
			label: "3 - Moderate (Deep Dive) [Professional]",
			value: { depth: 3, persona: "Professional" },
		},
		{
			label: "4 - Deep (Internals) [Expert]",
			value: { depth: 4, persona: "Expert" },
		},
		{
			label: "5 - Expert (Mastery) [Researcher]",
			value: { depth: 5, persona: "Researcher" },
		},
	];

	const initialSelectionIndex =
		suggestedDepth && suggestedDepth >= 1 && suggestedDepth <= 5
			? suggestedDepth - 1
			: 0;

	if (clarificationData) {
		return (
			<ClarificationScreen
				question={clarificationData.question}
				options={clarificationData.options}
				onSubmit={handleClarificationSubmit}
			/>
		);
	}

	return (
		<Box flexDirection="column" padding={1}>
			<Gradient name="pastel">
				<BigText text="Explain It" font="chrome" />
			</Gradient>

			<Box marginY={1}>
				<Text>Let me explain anything to you using the Feynman Method.</Text>
			</Box>

			{step === 0 && (
				<Box flexDirection="column">
					<Text bold>What do you want to learn?</Text>
					<Box borderStyle="round" borderColor="blue" paddingX={1}>
						{isLoading ? (
							<Text>
								<Spinner type="dots" /> {statusMessage}
							</Text>
						) : (
							<TextInput
								value={query}
								onChange={setQuery}
								onSubmit={handleQuerySubmit}
								placeholder="e.g. React hooks, Quantum Physics..."
							/>
						)}
					</Box>
					{!isLoading && <Text color="gray">Press Enter to continue</Text>}
				</Box>
			)}

			{step === 1 && (
				<Box flexDirection="column">
					<Text bold>
						Select Depth Level
						{suggestedDepth ? ` (Suggested: ${suggestedDepth})` : ""}:
					</Text>
					<SelectInput
						items={depthOptions}
						onSelect={handleDepthSelect}
						initialIndex={initialSelectionIndex}
					/>
				</Box>
			)}
		</Box>
	);
};

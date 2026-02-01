import { Box, Text } from "ink";
import BigText from "ink-big-text";
import Gradient from "ink-gradient";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import type React from "react";
import { useState } from "react";

export type UserInput = {
	query: string;
	depth: number;
};

interface InputScreenProps {
	onSubmit: (input: UserInput) => void;
}

export const InputScreen: React.FC<InputScreenProps> = ({ onSubmit }) => {
	const [query, setQuery] = useState("");
	const [step, setStep] = useState(0); // 0 = query, 1 = depth

	const handleQuerySubmit = (value: string) => {
		if (!value.trim()) return;
		setQuery(value);
		setStep(1);
	};

	const handleDepthSelect = (item: { value: number }) => {
		onSubmit({ query, depth: item.value });
	};

	const depthOptions = [
		{ label: "1 - Overview (5-10 mins)", value: 1 },
		{ label: "2 - Basics (Get Started)", value: 2 },
		{ label: "3 - Moderate (Deep Dive) [Default]", value: 3 },
		{ label: "4 - Deep (Internals)", value: 4 },
		{ label: "5 - Expert (Mastery)", value: 5 },
	];

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
						<TextInput
							value={query}
							onChange={setQuery}
							onSubmit={handleQuerySubmit}
							placeholder="e.g. React hooks, Quantum Physics..."
						/>
					</Box>
					<Text color="gray">Press Enter to continue</Text>
				</Box>
			)}

			{step === 1 && (
				<Box flexDirection="column">
					<Text bold>Select Depth Level:</Text>
					<SelectInput items={depthOptions} onSelect={handleDepthSelect} />
				</Box>
			)}
		</Box>
	);
};

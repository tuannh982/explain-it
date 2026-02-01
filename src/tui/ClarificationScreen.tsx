import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import type React from "react";
import { useState } from "react";

interface ClarificationScreenProps {
	question: string;
	options?: string[];
	onSubmit: (answer: string) => void;
}

export const ClarificationScreen: React.FC<ClarificationScreenProps> = ({
	question,
	options,
	onSubmit,
}) => {
	const [answer, setAnswer] = useState("");

	const handleSubmit = (value: string) => {
		if (!value.trim()) return;
		onSubmit(value);
	};

	const handleSelect = (item: { label: string }) => {
		onSubmit(item.label);
	};

	const selectItems = options
		? options.map((opt) => ({ label: opt, value: opt }))
		: [];

	return (
		<Box
			flexDirection="column"
			padding={1}
			borderStyle="round"
			borderColor="yellow"
		>
			<Text bold color="yellow">
				Needs Clarification
			</Text>
			<Box marginY={1}>
				<Text>{question}</Text>
			</Box>

			{options && options.length > 0 ? (
				<Box flexDirection="column">
					<Text color="gray">Select an option:</Text>
					<SelectInput items={selectItems} onSelect={handleSelect} />
				</Box>
			) : (
				<Box borderStyle="single" borderColor="blue" paddingX={1}>
					<TextInput
						value={answer}
						onChange={setAnswer}
						onSubmit={handleSubmit}
						placeholder="Type your answer..."
					/>
				</Box>
			)}
		</Box>
	);
};

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
	const [isManualInput, setIsManualInput] = useState(false);

	const handleSubmit = (value: string) => {
		if (!value.trim()) return;
		// Reset state just in case, though component likely unmounts
		setIsManualInput(false);
		onSubmit(value);
	};

	const handleSelect = (item: { label: string; value: string }) => {
		if (item.value === "__manual__") {
			setIsManualInput(true);
		} else {
			onSubmit(item.label);
		}
	};

	const selectItems = options
		? [
				...options.map((opt) => ({ label: opt, value: opt })),
				{ label: "Other (Manual Input)", value: "__manual__" },
			]
		: [];

	const showTextInput = (options && options.length === 0) || isManualInput;

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

			{!showTextInput ? (
				<Box flexDirection="column">
					<Text color="gray">Select an option:</Text>
					<SelectInput items={selectItems} onSelect={handleSelect} />
				</Box>
			) : (
				<Box flexDirection="column">
					<Text color="gray">
						{isManualInput ? "Enter your answer:" : "Type your answer:"}
					</Text>
					<Box borderStyle="single" borderColor="blue" paddingX={1}>
						<TextInput
							value={answer}
							onChange={setAnswer}
							onSubmit={handleSubmit}
							placeholder="Type here..."
						/>
					</Box>
				</Box>
			)}
		</Box>
	);
};

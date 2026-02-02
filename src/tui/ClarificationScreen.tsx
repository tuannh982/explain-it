import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import type React from "react";
import { useState } from "react";

interface ClarificationContext {
	topic: string;
	requirements: Record<string, string>;
	suggestions: { approach: string; reason: string }[];
}

interface ClarificationScreenProps {
	question: string;
	options?: string[];
	onSubmit: (answer: string) => void;
	context?: ClarificationContext;
}

export const ClarificationScreen: React.FC<ClarificationScreenProps> = ({
	question,
	options,
	onSubmit,
	context,
}) => {
	const [answer, setAnswer] = useState("");
	const [isManualInput, setIsManualInput] = useState(false);

	const handleSubmit = (value: string) => {
		if (!value.trim()) return;
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
				{context ? "Confirmation" : "Needs Clarification"}
			</Text>

			{context && (
				<Box flexDirection="column" marginY={1} paddingX={1}>
					<Text color="cyan" bold>Summary</Text>
					<Text>Topic: {context.topic}</Text>
					{Object.entries(context.requirements).map(([key, value]) => (
						<Text key={key} color="gray">  {key}: {value}</Text>
					))}
					{context.suggestions.length > 0 && (
						<Box flexDirection="column" marginTop={1}>
							<Text color="green" bold>Suggested Approach</Text>
							{context.suggestions.map((s) => (
								<Text key={s.approach} color="white">  {s.approach}: <Text color="gray">{s.reason}</Text></Text>
							))}
						</Box>
					)}
				</Box>
			)}

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

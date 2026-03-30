import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import Confetti from 'react-confetti';

import {
	createCase,
	fetchCase,
	fetchGuessCooldown,
	sendMessageToSuspect,
	submitGuess,
} from '../api/caseApi';
import type { MurderCase } from '../types/case';
import styles from './MainGamePage.module.css';

function secondsUntil(isoTime: string | null): number {
	if (!isoTime) {
		return 0;
	}

	const remainingMs = new Date(isoTime).getTime() - Date.now();
	return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
}

function formatClock(totalSeconds: number): string {
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

type GenerationStage = {
	label: string;
	playerFacing: string;
	behindScenes: string;
};

const generationStages: GenerationStage[] = [
	{
		label: 'Generating setting',
		playerFacing:
			'Sketching the world of this mystery: theme, tone, and crime location.',
		behindScenes:
			'The backend requests a structured setting payload and validates required fields before moving forward.',
	},
	{
		label: 'Defining victim',
		playerFacing:
			'Locking in who the victim is and the forensic basics of the scene.',
		behindScenes:
			'The pipeline generates victim data and cross-checks that wound details can later match candidate weapons.',
	},
	{
		label: 'Forging weapons',
		playerFacing:
			'Creating suspicious weapons that fit this setting and crime wound.',
		behindScenes:
			'Weapon objects are generated with ownership and a single true murder weapon flag expected by invariants.',
	},
	{
		label: 'Choosing suspects',
		playerFacing:
			'Assembling the suspect cast and assigning exactly one real culprit.',
		behindScenes:
			'Suspect candidates are validated for count and structure, then the model output is normalized for consistency.',
	},
	{
		label: 'Mapping weapon visibility',
		playerFacing:
			'Deciding who has seen which weapons to seed future interrogations.',
		behindScenes:
			'Relationship mappings connect suspect knowledge to weapons so discovery rules can be enforced server-side.',
	},
	{
		label: 'Building relationships and alibis',
		playerFacing:
			'Connecting suspects with motives, tensions, and alibi links.',
		behindScenes:
			'The service creates suspect-to-suspect relationship records plus corroborated or conflicting alibi network data.',
	},
	{
		label: 'Building suspect profiles',
		playerFacing: 'Writing each suspect voice, demeanor, and hidden backstory.',
		behindScenes:
			'Each suspect profile is generated in its own validated step, with retries and deterministic fallback when needed.',
	},
	{
		label: 'Finalizing case',
		playerFacing:
			'Final consistency pass and activation of your playable case.',
		behindScenes:
			'Invariant checks confirm one guilty suspect and one true weapon before the case is persisted as active.',
	},
];

function resolveStage(label: string | null | undefined): {
	index: number;
	stage: GenerationStage;
} {
	const fallbackStage = generationStages[0];

	if (!label) {
		return { index: 0, stage: fallbackStage };
	}

	const matchIndex = generationStages.findIndex(
		(stage) => stage.label === label,
	);

	if (matchIndex < 0) {
		return { index: 0, stage: fallbackStage };
	}

	return {
		index: matchIndex,
		stage: generationStages[matchIndex],
	};
}

export function MainGamePage() {
	const [activeCase, setActiveCase] = useState<MurderCase | null>(null);
	const [selectedSuspectId, setSelectedSuspectId] = useState<string | null>(
		null,
	);
	const [chatInput, setChatInput] = useState('');
	const [guessSuspectId, setGuessSuspectId] = useState('');
	const [guessWeaponId, setGuessWeaponId] = useState('');
	const [guessFeedback, setGuessFeedback] = useState<string | null>(null);
	const [chatFeedback, setChatFeedback] = useState<string | null>(null);
	const [pendingExchange, setPendingExchange] = useState<{
		suspectId: string;
		userMessage: string;
		suspectReply: string | null;
		isWaiting: boolean;
		fadingOut: boolean;
	} | null>(null);
	const [showSolvedModal, setShowSolvedModal] = useState(false);
	const [solvedSummary, setSolvedSummary] = useState<{
		suspectName: string;
		weaponName: string;
		solveDurationSeconds: number;
	} | null>(null);
	const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
	const [liveNow, setLiveNow] = useState(Date.now);
	const chatLogRef = useRef<HTMLDivElement>(null);

	const createCaseMutation = useMutation({
		mutationFn: createCase,
		onSuccess: (nextCase) => {
			setActiveCase(nextCase);
			setGuessFeedback(null);
			setChatInput('');
			setShowSolvedModal(false);
			setSolvedSummary(null);
			setGuessWeaponId('');
		},
	});

	const chatMutation = useMutation({
		mutationFn: sendMessageToSuspect,
	});

	const guessMutation = useMutation({
		mutationFn: submitGuess,
		onSuccess: async (result) => {
			if (result.isCorrect && result.solution) {
				setGuessFeedback(
					`Correct. ${result.solution.suspectName} used ${result.solution.weaponName}.`,
				);

				const startedAt = activeCase?.startedAt
					? new Date(activeCase.startedAt)
					: null;
				const solvedAt = result.solvedAt
					? new Date(result.solvedAt)
					: new Date();
				const solveDurationSeconds = startedAt
					? Math.max(
							0,
							Math.floor((solvedAt.getTime() - startedAt.getTime()) / 1000),
						)
					: 0;

				setSolvedSummary({
					suspectName: result.solution.suspectName,
					weaponName: result.solution.weaponName,
					solveDurationSeconds,
				});
				setShowSolvedModal(true);
			} else {
				setGuessFeedback(
					`Wrong guess. Cooldown started (${result.lockedRemainingSeconds}s).`,
				);
			}

			if (activeCase) {
				const nextCase = await fetchCase(activeCase.id);
				setActiveCase(nextCase);
			}
		},
		onError: (error) => {
			setGuessFeedback(error instanceof Error ? error.message : 'Guess failed');
		},
	});

	const caseQuery = useQuery({
		queryKey: ['case', activeCase?.id],
		queryFn: () => fetchCase(activeCase!.id),
		enabled: Boolean(activeCase?.id),
		refetchInterval: (query) => {
			const nextCase = query.state.data as MurderCase | undefined;
			if (!nextCase) {
				return 1500;
			}

			return nextCase.status === 'generating' ? 1500 : false;
		},
	});

	const cooldownQuery = useQuery({
		queryKey: ['cooldown', activeCase?.id],
		queryFn: () => fetchGuessCooldown(activeCase!.id),
		enabled: Boolean(activeCase?.id),
		refetchInterval: (query) => {
			const lockedSeconds =
				(query.state.data?.lockedRemainingSeconds as number | undefined) || 0;
			return lockedSeconds > 0 ? 1000 : 5000;
		},
	});

	useEffect(() => {
		if (caseQuery.data) {
			setActiveCase(caseQuery.data);
		}
	}, [caseQuery.data]);

	useEffect(() => {
		const updateViewport = () => {
			setViewportSize({ width: window.innerWidth, height: window.innerHeight });
		};

		updateViewport();
		window.addEventListener('resize', updateViewport);
		return () => window.removeEventListener('resize', updateViewport);
	}, []);

	useEffect(() => {
		if (!activeCase) {
			setSelectedSuspectId(null);
			setGuessSuspectId('');
			return;
		}

		if (!selectedSuspectId && activeCase.suspects.length > 0) {
			setSelectedSuspectId(activeCase.suspects[0].id);
		}

		if (!guessSuspectId && activeCase.suspects.length > 0) {
			setGuessSuspectId(activeCase.suspects[0].id);
		}
	}, [activeCase, selectedSuspectId, guessSuspectId]);

	useEffect(() => {
		if (!activeCase || activeCase.status !== 'active') return;
		const id = setInterval(() => setLiveNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, [activeCase?.id, activeCase?.status]);

	const activeSuspect = activeCase?.suspects.find(
		(suspect) => suspect.id === selectedSuspectId,
	);

	const selectedSuspectChat =
		activeCase?.chats.filter(
			(message) => message.suspectId === selectedSuspectId,
		) || [];

	const selectedSuspectPendingMessages =
		pendingExchange && pendingExchange.suspectId === selectedSuspectId
			? [
					{
						id: `pending-user-${pendingExchange.suspectId}`,
						role: 'user' as const,
						content: pendingExchange.userMessage,
						typing: false,
						fadingOut: false,
					},
					{
						id: `pending-suspect-${pendingExchange.suspectId}`,
						role: 'suspect' as const,
						content: pendingExchange.isWaiting
							? '...'
							: pendingExchange.suspectReply || '...',
						typing: pendingExchange.isWaiting,
						fadingOut: pendingExchange.fadingOut,
					},
				]
			: [];

	const renderedSuspectChat = [
		...selectedSuspectChat.map((message) => ({
			id: message.id,
			role: message.role,
			content: message.content,
			typing: false,
			fadingOut: false,
		})),
		...selectedSuspectPendingMessages,
	];

	// eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect(() => {
		chatLogRef.current?.scrollTo({ top: chatLogRef.current.scrollHeight });
	}, [renderedSuspectChat.length, selectedSuspectId]);

	const discoveredWeaponOptions = activeCase?.discoveredWeapons || [];
	const cooldownSeconds =
		cooldownQuery.data?.lockedRemainingSeconds ||
		secondsUntil(activeCase?.guessCooldownUntil || null);
	const isGuessLocked = cooldownSeconds > 0;
	const canSubmitGuess = Boolean(
		guessSuspectId && guessWeaponId && !isGuessLocked,
	);

	const elapsedGameSeconds = activeCase?.startedAt
		? Math.max(
				0,
				Math.floor(
					((activeCase.solvedAt
						? new Date(activeCase.solvedAt).getTime()
						: liveNow) -
						new Date(activeCase.startedAt).getTime()) /
						1000,
				),
			)
		: 0;

	const showGenerateButton =
		!activeCase ||
		activeCase.status === 'idle' ||
		activeCase.status === 'failed' ||
		(activeCase.status === 'solved' && !showSolvedModal);

	const currentGenerationStage = resolveStage(activeCase?.generationStepLabel);

	const handleSendChat = () => {
		if (!activeCase || !selectedSuspectId || !chatInput.trim()) {
			return;
		}

		const userMessage = chatInput.trim();
		setChatInput('');
		setChatFeedback(null);
		setPendingExchange({
			suspectId: selectedSuspectId,
			userMessage,
			suspectReply: null,
			isWaiting: true,
			fadingOut: false,
		});

		chatMutation.mutate(
			{
				caseId: activeCase.id,
				suspectId: selectedSuspectId,
				message: userMessage,
			},
			{
				onSuccess: async (result) => {
					// Start fade-out of typing bubble
					setPendingExchange((previous) => {
						if (!previous || previous.suspectId !== selectedSuspectId)
							return previous;
						return { ...previous, fadingOut: true };
					});

					await new Promise<void>((resolve) => setTimeout(resolve, 220));

					// Show real reply (CSS bubbleFadeIn kicks in)
					setPendingExchange((previous) => {
						if (!previous || previous.suspectId !== selectedSuspectId)
							return previous;
						return {
							...previous,
							isWaiting: false,
							suspectReply: result.reply,
							fadingOut: false,
						};
					});

					const nextCase = await fetchCase(activeCase.id);
					setActiveCase(nextCase);
					setPendingExchange(null);
				},
				onError: (error) => {
					setPendingExchange(null);
					setChatFeedback(
						error instanceof Error ? error.message : 'Failed to send message',
					);
				},
			},
		);
	};

	const handleSubmitGuess = () => {
		if (!activeCase || !canSubmitGuess) {
			return;
		}

		guessMutation.mutate({
			caseId: activeCase.id,
			suspectId: guessSuspectId,
			weaponId: guessWeaponId,
		});
	};

	const handleChatInputKeyDown = (
		event: KeyboardEvent<HTMLTextAreaElement>,
	) => {
		if (event.key !== 'Enter') {
			return;
		}

		if (event.altKey) {
			return;
		}

		event.preventDefault();
		handleSendChat();
	};

	const activeSuspectName = activeSuspect?.name || 'Suspect';

	return (
		<main className={styles.page}>
			{showSolvedModal && solvedSummary ? (
				<>
					<Confetti
						recycle={false}
						numberOfPieces={420}
						width={viewportSize.width}
						height={viewportSize.height}
					/>
					<div className={styles.modalBackdrop}>
						<div className={styles.modalCard}>
							<h2>Case Solved</h2>
							<p>
								You identified <strong>{solvedSummary.suspectName}</strong> and
								the weapon <strong>{solvedSummary.weaponName}</strong>.
							</p>
							<p>
								Solve time: {formatClock(solvedSummary.solveDurationSeconds)}
							</p>
							<button
								className={styles.button}
								type="button"
								onClick={() => setShowSolvedModal(false)}
							>
								Close
							</button>
						</div>
					</div>
				</>
			) : null}
			<section className={styles.card}>
				<h1 className={styles.title}>AI Murder Mystery</h1>
				<p className={styles.subtitle}>
					Start a case to initialize the generation pipeline and inspect the
					first case shell.
				</p>

				<div className={styles.controls}>
					{activeCase?.status === 'active' ||
					activeCase?.status === 'solved' ? (
						<p className={styles.timer}>
							Game Timer: {formatClock(elapsedGameSeconds)}
						</p>
					) : null}
					{showGenerateButton ? (
						<button
							className={styles.button}
							type="button"
							onClick={() => createCaseMutation.mutate()}
							disabled={createCaseMutation.isPending}
						>
							{createCaseMutation.isPending
								? 'Generating...'
								: 'Start New Case'}
						</button>
					) : null}
				</div>

				{createCaseMutation.isError ? (
					<p className={styles.warning}>
						Failed to create case:{' '}
						{createCaseMutation.error instanceof Error
							? createCaseMutation.error.message
							: 'Server unreachable or returned an error'}
					</p>
				) : null}

				{activeCase ? (
					activeCase.status === 'generating' ? (
						<article className={styles.caseBox}>
							<h2>Generating New Case</h2>
							<p className={styles.stageNow}>
								<span className={styles.stageSpinner} aria-hidden="true" />
								Current stage: {currentGenerationStage.stage.label}
							</p>
							<p>{currentGenerationStage.stage.playerFacing}</p>
							<p className={styles.behindScenes}>
								Behind the scenes: {currentGenerationStage.stage.behindScenes}
							</p>
							<div className={styles.progressTrack} aria-hidden="true">
								<div
									className={styles.progressFill}
									style={{ width: `${activeCase.generationProgress}%` }}
								/>
							</div>
							<div className={styles.progressMeta}>
								<p>{activeCase.generationProgress}% complete</p>
								<p>
									Stage {currentGenerationStage.index + 1} of{' '}
									{generationStages.length}
								</p>
							</div>
							<ul className={styles.stageList}>
								{generationStages.map((stage, index) => {
									const stateClassName =
										index < currentGenerationStage.index
											? styles.stageDone
											: index === currentGenerationStage.index
												? styles.stageCurrent
												: styles.stageUpcoming;

									return (
										<li key={stage.label} className={stateClassName}>
											<span className={styles.stageIndex}>{index + 1}</span>
											<div>
												<p className={styles.stageLabel}>{stage.label}</p>
												<p className={styles.stageHint}>{stage.playerFacing}</p>
											</div>
										</li>
									);
								})}
							</ul>
						</article>
					) : (
						<>
							<article className={styles.caseBox}>
								<h2>{activeCase.theme}</h2>
								<p>{activeCase.storySummary}</p>
								<p>Location: {activeCase.locationName}</p>
								<p>
									Victim: {activeCase.victim.name} in{' '}
									{activeCase.victim.bodyFoundRoom}
								</p>
								<p>Time of death: {activeCase.victim.timeOfDeath}</p>
								<p>Wound: {activeCase.victim.murderWound}</p>
								<p>Status: {activeCase.status}</p>
							</article>

							<div className={styles.investigationLayout}>
								<article className={`${styles.caseBox} ${styles.suspectPanel}`}>
									<h3>Suspect Questioning</h3>
									<div className={styles.suspectWorkspace}>
										<div className={styles.tabsColumn}>
											{activeCase.suspects.map((suspect) => (
												<button
													key={suspect.id}
													type="button"
													className={
														suspect.id === selectedSuspectId
															? styles.tabActive
															: styles.tab
													}
													onClick={() => setSelectedSuspectId(suspect.id)}
												>
													{suspect.name}
												</button>
											))}
										</div>

										<div className={styles.chatColumn}>
											<h4>{activeSuspect?.name || 'Select suspect'}</h4>
											<div className={styles.chatLog} ref={chatLogRef}>
												{renderedSuspectChat.length === 0 ? (
													<p>No messages yet.</p>
												) : (
													renderedSuspectChat.map((message) => (
														<article
															key={message.id}
															className={
																message.role === 'user'
																	? styles.messageRowDetective
																	: message.role === 'suspect'
																		? styles.messageRowSuspect
																		: styles.messageRowSystem
															}
														>
															<p
																className={
																	message.role === 'user'
																		? styles.messageAuthorDetective
																		: message.role === 'suspect'
																			? styles.messageAuthorSuspect
																			: styles.messageAuthorSystem
																}
															>
																{message.role === 'user'
																	? 'Detective'
																	: message.role === 'suspect'
																		? activeSuspectName
																		: 'System'}
															</p>
															<p
																className={[
																	message.role === 'user'
																		? styles.messageBubbleDetective
																		: message.role === 'suspect'
																			? styles.messageBubbleSuspect
																			: styles.messageBubbleSystem,
																	message.fadingOut
																		? styles.bubbleFadeOut
																		: styles.bubbleFadeIn,
																].join(' ')}
																data-typing={message.typing ? 'true' : 'false'}
															>
																{message.typing ? (
																	<span className={styles.typingDots}>
																		<span>.</span>
																		<span>.</span>
																		<span>.</span>
																	</span>
																) : (
																	message.content
																)}
															</p>
														</article>
													))
												)}
											</div>
											<div className={styles.chatControls}>
												<textarea
													className={`${styles.textInput} ${styles.chatInputArea}`}
													value={chatInput}
													onChange={(event) => setChatInput(event.target.value)}
													onKeyDown={handleChatInputKeyDown}
													placeholder="Question this suspect... (Enter to send, Alt+Enter for new line)"
													disabled={
														chatMutation.isPending ||
														activeCase.status === 'solved'
													}
												/>
												<button
													className={styles.button}
													type="button"
													onClick={handleSendChat}
													disabled={
														chatMutation.isPending ||
														!selectedSuspectId ||
														!chatInput.trim() ||
														activeCase.status === 'solved'
													}
												>
													{chatMutation.isPending ? 'Sending...' : 'Send'}
												</button>
											</div>
											{chatFeedback ? (
												<p className={styles.warning}>{chatFeedback}</p>
											) : null}
										</div>
									</div>
								</article>

								<div className={styles.sidePanels}>
									<article className={styles.caseBox}>
										<h3>Discovered Weapons</h3>
										{discoveredWeaponOptions.length === 0 ? (
											<p>No discovered weapons yet.</p>
										) : (
											<ul className={styles.list}>
												{discoveredWeaponOptions.map((entry) => (
													<li key={entry.weaponId}>{entry.weaponName}</li>
												))}
											</ul>
										)}
									</article>

									{activeCase.status !== 'solved' ? (
										<article className={styles.caseBox}>
											<h3>Conclusion</h3>
											<label className={styles.label}>
												Suspect
												<select
													className={styles.select}
													value={guessSuspectId}
													onChange={(event) =>
														setGuessSuspectId(event.target.value)
													}
												>
													{activeCase.suspects.map((suspect) => (
														<option key={suspect.id} value={suspect.id}>
															{suspect.name}
														</option>
													))}
												</select>
											</label>

											<label className={styles.label}>
												Weapon
												<select
													className={styles.select}
													value={guessWeaponId}
													onChange={(event) =>
														setGuessWeaponId(event.target.value)
													}
												>
													<option value="">Select discovered weapon</option>
													{discoveredWeaponOptions.map((entry) => (
														<option key={entry.weaponId} value={entry.weaponId}>
															{entry.weaponName}
														</option>
													))}
												</select>
											</label>

											<button
												className={styles.button}
												type="button"
												onClick={handleSubmitGuess}
												disabled={
													!canSubmitGuess ||
													guessMutation.isPending ||
													discoveredWeaponOptions.length === 0
												}
											>
												{guessMutation.isPending
													? 'Submitting...'
													: 'Submit Guess'}
											</button>

											{isGuessLocked ? (
												<p className={styles.warning}>
													Guessing locked: {formatClock(cooldownSeconds)}
												</p>
											) : null}

											{guessFeedback ? <p>{guessFeedback}</p> : null}
										</article>
									) : (
										<article className={styles.caseBox}>
											<h3>Case Closed</h3>
											<p>
												The culprit has been confirmed. Chat remains readable,
												and you can generate a new case from the callout below.
											</p>
											{guessFeedback ? <p>{guessFeedback}</p> : null}
										</article>
									)}
								</div>
							</div>
						</>
					)
				) : null}

				{activeCase?.status === 'solved' && !showSolvedModal ? (
					<article className={styles.nextCaseCallout}>
						<h3>Ready For Another Mystery?</h3>
						<p>Start a fresh case whenever you want to investigate again.</p>
						<button
							className={styles.button}
							type="button"
							onClick={() => createCaseMutation.mutate()}
							disabled={createCaseMutation.isPending}
						>
							{createCaseMutation.isPending
								? 'Generating...'
								: 'Generate Next Case'}
						</button>
					</article>
				) : null}
			</section>
		</main>
	);
}

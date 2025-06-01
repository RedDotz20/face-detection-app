import { useRef, useEffect, useState, useCallback } from "react";
import * as faceapi from "face-api.js";
import { labels } from "./data/labels";
import PropTypes from "prop-types";

const DETECTION_INTERVAL = 1000;
const VIDEO_DIMENSIONS = { width: 940, height: 650 };
const MODELS_PATH = "/models";

export default function App() {
	const [isVideoOn, setIsVideoOn] = useState(false);
	const [isVideoInitialized, setIsVideoInitialized] = useState(false);
	const [areModelsLoaded, setAreModelsLoaded] = useState(false);
	const [error, setError] = useState(null);
	const [isLoading, setIsLoading] = useState(true);

	const videoRef = useRef();
	const canvasRef = useRef();
	const detectionIntervalRef = useRef(null);

	useEffect(() => {
		let mounted = true;

		const cleanup = () => {
			mounted = false;
			clearInterval(detectionIntervalRef.current);
			stopVideo();
		};

		if (isVideoOn) {
			initializeVideo().catch((err) => {
				if (mounted) {
					setError(err.message);
					setIsVideoOn(false);
				}
			});
		} else {
			stopVideo();
		}

		return cleanup;
	}, [isVideoOn]);

	const startFaceDetection = useCallback(async () => {
		if (!isVideoInitialized || !videoRef.current) return;

		try {
			const labeledFaceDescriptors = await getLabeledFaceDescriptions();

			if (!labeledFaceDescriptors?.length) {
				throw new Error("No face descriptors found");
			}

			const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors);

			detectionIntervalRef.current = setInterval(async () => {
				if (!canvasRef.current || !videoRef.current) return;

				try {
					const detections = await faceapi
						.detectAllFaces(videoRef.current)
						.withFaceLandmarks()
						.withFaceDescriptors();

					const canvas = canvasRef.current;
					const ctx = canvas.getContext("2d");
					ctx.clearRect(0, 0, canvas.width, canvas.height);

					const resizedDetections = faceapi.resizeResults(
						detections,
						VIDEO_DIMENSIONS
					);

					faceapi.draw.drawDetections(canvas, resizedDetections);

					resizedDetections.forEach((detection) => {
						const match = faceMatcher.findBestMatch(detection.descriptor);
						const drawBox = new faceapi.draw.DrawBox(detection.detection.box, {
							label: match.toString(),
						});
						drawBox.draw(canvas);
					});
				} catch (error) {
					console.error("Frame processing error:", error);
				}
			}, DETECTION_INTERVAL);
		} catch (error) {
			setError(`Face detection failed: ${error.message}`);
			console.error("Face detection error:", error);
		}
	}, [isVideoInitialized]); // Remove getLabeledFaceDescriptions from dependencies

	const loadModels = useCallback(async () => {
		try {
			setIsLoading(true);
			await Promise.all([
				faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS_PATH),
				faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_PATH),
				faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_PATH),
			]);
			setAreModelsLoaded(true);
			if (isVideoOn) {
				await startFaceDetection();
			}
		} catch (error) {
			setError(`Failed to load models: ${error.message}`);
			console.error("Error loading models:", error);
		} finally {
			setIsLoading(false);
		}
	}, [isVideoOn, startFaceDetection]);

	useEffect(() => {
		loadModels();
	}, [loadModels]);

	const initializeVideo = async () => {
		try {
			const constraints = {
				video: {
					width: VIDEO_DIMENSIONS.width,
					height: VIDEO_DIMENSIONS.height,
				},
			};
			const stream = await navigator.mediaDevices.getUserMedia(constraints);

			if (!videoRef.current) return;

			videoRef.current.srcObject = stream;

			return new Promise((resolve) => {
				videoRef.current.onloadedmetadata = () => {
					setIsVideoInitialized(true);
					resolve();
				};
			});
		} catch (error) {
			setError(`Camera access denied: ${error.message}`);
			throw error;
		}
	};

	const stopVideo = useCallback(() => {
		if (videoRef.current?.srcObject) {
			const tracks = videoRef.current.srcObject.getTracks();
			tracks.forEach((track) => track.stop());
			videoRef.current.srcObject = null;
		}
		setIsVideoInitialized(false);
		clearInterval(detectionIntervalRef.current);
	}, []);

	const getLabeledFaceDescriptions = async () => {
		try {
			const labeledFaceDescriptors = [];

			await Promise.all(
				labels.map(async (label) => {
					const descriptors = [];

					for (let i = 0; i < labels.length; i++) {
						try {
							const image = await faceapi.fetchImage(
								`/images/${label}/${i}.jpg`
							);
							const detection = await faceapi
								.detectSingleFace(image)
								.withFaceLandmarks()
								.withFaceDescriptor();

							if (detection) {
								descriptors.push(detection.descriptor);
							}
						} catch (error) {
							console.warn(
								`Failed to process image ${i} for label ${label}:`,
								error
							);
						}
					}

					if (descriptors.length > 0) {
						labeledFaceDescriptors.push(
							new faceapi.LabeledFaceDescriptors(label, descriptors)
						);
					}
				})
			);

			return labeledFaceDescriptors;
		} catch (error) {
			setError(`Failed to process face descriptions: ${error.message}`);
			throw error;
		}
	};

	const toggleVideo = useCallback(async () => {
		try {
			if (isVideoOn) {
				stopVideo();
				setIsVideoOn(false);
			} else {
				setIsVideoOn(true);
				await initializeVideo();
				if (areModelsLoaded) {
					await startFaceDetection();
				}
			}
		} catch (error) {
			setError(`Failed to toggle video: ${error.message}`);
			setIsVideoOn(false);
		}
	}, [
		isVideoOn,
		areModelsLoaded,
		stopVideo,
		initializeVideo,
		startFaceDetection,
	]);

	if (error) {
		return (
			<div className="flex flex-col items-center justify-center h-screen">
				<div className="text-red-600 mb-4">Error: {error}</div>
				<button
					onClick={() => {
						setError(null);
						loadModels();
					}}
					className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
				>
					Retry
				</button>
			</div>
		);
	}

	return (
		<div className="flex flex-col items-center w-screen h-screen justify-center">
			<h1 className="text-5xl font-semibold mb-4 tracking-widest">
				FACE DETECTION
			</h1>
			<div className="relative flex items-center justify-center min-h-[400px] mb-4 shadow-xl">
				{areModelsLoaded ? (
					isVideoOn ? (
						<>
							<video
								crossOrigin="anonymous"
								ref={videoRef}
								height={450}
								width={700}
								autoPlay
								playsInline
								muted
							></video>
							<canvas
								ref={canvasRef}
								height={450}
								width={700}
								className="absolute top-0 right-0 h-full w-full border border-white"
							/>
							<div className="absolute -z-1 w-full h-full bg-black"></div>
						</>
					) : (
						<div className="bg-gray-600 p-4 rounded-md h-[450px] w-[700px] text-white flex items-center justify-center">
							<h2>VIDEO IS TURNED OFF</h2>
						</div>
					)
				) : (
					<div className="bg-gray-300 text-gray-600 p-4 rounded-md">
						LOADING MODELS...
					</div>
				)}
			</div>
			<button
				onClick={toggleVideo}
				className={` text-white font-bold py-2 px-4 rounded w-40 shadow-2xl ${
					!isVideoOn
						? "bg-red-600 hover:bg-red-700"
						: "bg-green-600 hover:bg-green-700"
				}`}
			>
				{isVideoOn ? (
					<span className="flex gap-2 justify-center items-center">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							strokeWidth={1.5}
							stroke="currentColor"
							className="w-6 h-6"
						>
							<path
								strokeLinecap="round"
								d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"
							/>
						</svg>
						Video ON
					</span>
				) : (
					<span className="flex gap-2 justify-center items-center">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							strokeWidth={1.5}
							stroke="currentColor"
							className="w-6 h-6"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M12 18.75H4.5a2.25 2.25 0 01-2.25-2.25V9m12.841 9.091L16.5 19.5m-1.409-1.409c.407-.407.659-.97.659-1.591v-9a2.25 2.25 0 00-2.25-2.25h-9c-.621 0-1.184.252-1.591.659m12.182 12.182L2.909 5.909M1.5 4.5l1.409 1.409"
							/>
						</svg>
						Video OFF
					</span>
				)}
			</button>
		</div>
	);
}

App.propTypes = {
	modelPath: PropTypes.string,
	detectionInterval: PropTypes.number,
};

App.defaultProps = {
	modelPath: MODELS_PATH,
	detectionInterval: DETECTION_INTERVAL,
};

import React, { useRef, useEffect, useState } from 'react';
import * as faceapi from 'face-api.js';
import { labels } from './data/labels';

export default function App() {
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isVideoInitialized, setIsVideoInitialized] = useState(false);
  const [areModelsLoaded, setAreModelsLoaded] = useState(false);

  const videoRef = useRef();
  const canvasRef = useRef();
  const detectionIntervalRef = useRef(null);

  useEffect(() => {
    isVideoOn ? initializeVideo() : stopVideo();

    return () => {
      //? Cleanup on Unmount
      clearInterval(detectionIntervalRef.current);
      stopVideo();
    };
  }, [isVideoOn, isVideoInitialized]);

  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        ])
          .then(() => {
            setAreModelsLoaded(true);
            if (isVideoOn) {
              startVideo();
            }
          })
          .catch((error) => {
            console.error('Error loading models:', error);
          });
      } catch (error) {
        console.error('Error loading models:', error);
        throw error;
      }
    };

    loadModels();
  }, []);

  const initializeVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;

      videoRef.current.onloadedmetadata = () => {
        setIsVideoInitialized(true);

        if (areModelsLoaded) {
          startVideo();
        }
      };
    } catch (error) {
      console.error('Error initializing video:', error);
      setIsVideoOn(false);
    }
  };

  const startVideo = () => {
    if (!isVideoInitialized) {
      //? Wait for Video to Initialize before Starting
      setTimeout(startVideo, 100);
      return;
    }

    videoRef.current.play().then(() => {
      startFaceDetection();
    });
  };

  const stopVideo = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
  };

  const toggleVideo = () => setIsVideoOn((prevIsVideoOn) => !prevIsVideoOn);

  const getLabeledFaceDescriptions = async () => {
    const labeledFaceDescriptors = [];

    await Promise.all(
      labels.map(async (label) => {
        const descriptors = [];

        for (let i = 0; i < labels.length; i++) {
          const image = await faceapi.fetchImage(`/images/${label}/${i}.jpg`);

          const detections = await faceapi
            .detectSingleFace(image)
            .withFaceLandmarks()
            .withFaceDescriptor();

          descriptors.push(detections.descriptor);
        }

        if (descriptors.length > 0) {
          const flattenedDescriptors = descriptors.flat();

          labeledFaceDescriptors.push(
            new faceapi.LabeledFaceDescriptors(label, flattenedDescriptors)
          );
        }
      })
    );

    return labeledFaceDescriptors;
  };

  const startFaceDetection = async () => {
    if (!isVideoInitialized) {
      return; //! Avoid processing frames if video is not initialized
    }

    const labeledFaceDescriptors = await getLabeledFaceDescriptions();
    console.log(labeledFaceDescriptors);

    if (!labeledFaceDescriptors || labeledFaceDescriptors.length === 0) {
      console.error('Labeled face descriptors are missing or empty.');
      return;
    }

    const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors);

    detectionIntervalRef.current = setInterval(async () => {
      try {
        const canvas = canvasRef.current;
        const displaySize = { width: 940, height: 650 };
        faceapi.matchDimensions(canvas, displaySize);

        const detections = await faceapi
          .detectAllFaces(videoRef.current)
          .withFaceLandmarks()
          .withFaceDescriptors();

        const resizedDetections = faceapi.resizeResults(
          detections,
          displaySize
        );

        faceapi.draw.drawDetections(canvas, resizedDetections);

        const results = resizedDetections.map((d) => {
          return faceMatcher.findBestMatch(d.descriptor);
        });

        results.forEach((result, i) => {
          const box = resizedDetections[i].detection.box;
          const drawBox = new faceapi.draw.DrawBox(box, {
            label: result,
          });
          drawBox.draw(canvas);
        });
      } catch (error) {
        console.error('Error detecting faces:', error);
      }
    }, 1000);
  };

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
              <div className="absolute -z-[1] w-full h-full bg-black"></div>
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
        className={` text-white font-bold py-2 px-4 rounded w-[10rem] shadow-2xl ${
          !isVideoOn
            ? 'bg-red-600 hover:bg-red-700'
            : 'bg-green-600 hover:bg-green-700'
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

import React, { useRef, useEffect, useState } from 'react';
import * as faceapi from 'face-api.js';

export default function App() {
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isVideoInitialized, setIsVideoInitialized] = useState(false);
  const [areModelsLoaded, setAreModelsLoaded] = useState(false);

  const videoRef = useRef();
  const canvasRef = useRef();
  const detectionIntervalRef = useRef(null);

  useEffect(() => {
    if (isVideoOn) {
      initializeVideo();
    } else {
      stopVideo();
    }

    // Cleanup on unmount
    return () => {
      clearInterval(detectionIntervalRef.current);
      stopVideo();
    };
  }, [isVideoOn, isVideoInitialized]);

  useEffect(() => {
    loadModels()
      .then(() => {
        setAreModelsLoaded(true);
        if (isVideoOn) {
          startVideo();
        }
      })
      .catch((error) => {
        console.error('Error loading models:', error);
      });
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
      // Wait for video to initialize before starting it
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

  const loadModels = async () => {
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
        faceapi.nets.faceExpressionNet.loadFromUri('/models'),
      ]);
    } catch (error) {
      console.error('Error loading models:', error);
      throw error;
    }
  };

  const toggleVideo = () => {
    setIsVideoOn((prevIsVideoOn) => !prevIsVideoOn);
  };

  const startFaceDetection = () => {
    detectionIntervalRef.current = setInterval(async () => {
      try {
        if (!isVideoInitialized) {
          return; //! Avoid processing frames if video is not initialized
        }

        const detections = await faceapi
          .detectAllFaces(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions()
          )
          .withFaceLandmarks()
          .withFaceExpressions();

        const canvas = canvasRef.current;
        faceapi.matchDimensions(canvas, {
          width: 940,
          height: 650,
        });

        const resizedDetections = faceapi.resizeResults(detections, {
          width: 940,
          height: 650,
        });

        faceapi.draw.drawDetections(canvas, resizedDetections);
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
        faceapi.draw.drawFaceExpressions(canvas, resizedDetections);
      } catch (error) {
        console.error('Error detecting faces:', error);
      }
    }, 1000);
  };

  return (
    <div className="flex flex-col items-center w-screen h-screen justify-center">
      <h1 className="text-4xl font-semibold mb-4">FACE DETECTION</h1>
      <div className="relative flex items-center justify-center">
        {areModelsLoaded ? (
          isVideoOn ? (
            <video
              crossOrigin="anonymous"
              ref={videoRef}
              height={450}
              width={700}
              autoPlay
              playsInline
            ></video>
          ) : (
            <div className="bg-gray-300 text-gray-600 p-4 rounded-md">
              Video is turned off
            </div>
          )
        ) : (
          <div className="bg-gray-300 text-gray-600 p-4 rounded-md">
            Loading models...
          </div>
        )}
        <canvas
          ref={canvasRef}
          height={450}
          width={700}
          className="absolute top-0 right-0 h-full w-full border border-white"
        />
        <div className="absolute -z-[1] w-full h-full bg-black"></div>
      </div>
      <button
        onClick={toggleVideo}
        className="absolute bottom-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-md"
      >
        {isVideoOn ? 'Turn Off Video' : 'Turn On Video'}
      </button>
    </div>
  );
}

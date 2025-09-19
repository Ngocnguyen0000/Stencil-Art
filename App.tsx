import React, { useState, useCallback, useEffect, useRef } from 'react';
import { FileUpload } from './components/FileUpload';
import { ToleranceSlider } from './components/ToleranceSlider';
import { Loader } from './components/Loader';
import { ColorGroupCard } from './components/ColorGroupCard';
import { PackageIcon, EyeIcon, UndoIcon, MergeIcon } from './components/Icons';
import { PreviewModal } from './components/PreviewModal';
import { SvgEditModal } from './components/SvgEditModal';
import { processSVG, processRaster } from './utils/imageProcessor';
import { colorDistance } from './utils/colorUtils';
import type { SVGColorGroup, RasterColorGroup, ImageDimensions } from './types';

// State interface for the application
interface AppState {
  file: File | null;
  fileContent: string | null;
  tolerance: number;
  isLoading: boolean;
  error: string | null;
  colorGroups: (SVGColorGroup | RasterColorGroup)[];
  dimensions: ImageDimensions | null;
  isSvgSource: boolean;
  originalImageData: ImageData | null;
  isPreviewModalOpen: boolean;
  deletedGroups: { group: (SVGColorGroup | RasterColorGroup); originalIndex: number }[];
  editingGroup: { index: number; group: SVGColorGroup } | null;
  reorderHistory: (SVGColorGroup | RasterColorGroup)[][];
  originalFilePreviewUrl: string | null;
  selectedGroupIndices: number[];
  mergeHistory: (SVGColorGroup | RasterColorGroup)[][];
}

const initialState: AppState = {
  file: null,
  fileContent: null,
  tolerance: 20,
  isLoading: false,
  error: null,
  colorGroups: [],
  dimensions: null,
  isSvgSource: false,
  originalImageData: null,
  isPreviewModalOpen: false,
  deletedGroups: [],
  editingGroup: null,
  reorderHistory: [],
  originalFilePreviewUrl: null,
  selectedGroupIndices: [],
  mergeHistory: [],
};

const createFinalSvgString = (innerHtml: string): string => {
    return `<svg width="600" height="600" viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg">${innerHtml}</svg>`;
};

const transformSvgElements = (elements: SVGElement[], dimensions: ImageDimensions | null): string => {
    if (!dimensions) return elements.map(el => el.outerHTML).join('');

    const viewBox = dimensions.viewBox || `0 0 ${dimensions.width} ${dimensions.height}`;
    const viewBoxParts = viewBox.split(/[ ,]+/).map(parseFloat);
    if (viewBoxParts.length !== 4 || viewBoxParts.some(isNaN)) return elements.map(el => el.outerHTML).join('');
    
    const [x, y, w, h] = viewBoxParts;
    if (w <= 0 || h <= 0) return elements.map(el => el.outerHTML).join('');

    const targetWidth = 600;
    const targetHeight = 600;
    const scale = Math.min(targetWidth / w, targetHeight / h);
    const translateX = (targetWidth - w * scale) / 2 - x * scale;
    const translateY = (targetHeight - h * scale) / 2 - y * scale;

    return elements.map(el => {
        const clone = el.cloneNode(true) as SVGElement;
        
        // Apply transform directly to path data
        const d = clone.getAttribute('d');
        if (d) {
             const transformedD = d.replace(/([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g, (_, command, argsStr) => {
                const args = (argsStr.trim().match(/[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?/g) || []).map(parseFloat);
                let newArgs = [];
                const isRelative = command === command.toLowerCase();

                switch(command.toLowerCase()) {
                    case 'a':
                        newArgs[0] = args[0] * scale;
                        newArgs[1] = args[1] * scale;
                        newArgs[2] = args[2];
                        newArgs[3] = args[3];
                        newArgs[4] = args[4];
                        newArgs[5] = isRelative ? args[5] * scale : (args[5] - x) * scale + (targetWidth - w * scale) / 2;
                        newArgs[6] = isRelative ? args[6] * scale : (args[6] - y) * scale + (targetHeight - h * scale) / 2;
                        break;
                    case 'h':
                        newArgs[0] = isRelative ? args[0] * scale : (args[0] - x) * scale + (targetWidth - w * scale) / 2;
                        break;
                    case 'v':
                         newArgs[0] = isRelative ? args[0] * scale : (args[0] - y) * scale + (targetHeight - h * scale) / 2;
                         break;
                    default:
                        for(let i=0; i<args.length; i+=2) {
                            newArgs.push(isRelative ? args[i] * scale : (args[i] - x) * scale + (targetWidth - w * scale) / 2);
                            newArgs.push(isRelative ? args[i+1] * scale : (args[i+1] - y) * scale + (targetHeight - h * scale) / 2);
                        }
                        break;
                }
                 if (command.toLowerCase() === 'z') return command;
                 return command + newArgs.join(' ');
            });
            clone.setAttribute('d', transformedD);
        }
        
        clone.removeAttribute('transform');

        return clone.outerHTML;
    }).join('');
};


interface ReassembledPreviewProps {
  isSvgSource: boolean;
  colorGroups: (SVGColorGroup | RasterColorGroup)[];
  dimensions: ImageDimensions | null;
  originalImageData: ImageData | null;
  tolerance: number;
}

const ReassembledPreview: React.FC<ReassembledPreviewProps> = ({ isSvgSource, colorGroups, dimensions, originalImageData, tolerance }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // SVG Preview
    if (isSvgSource) {
      const allElements = colorGroups.flatMap(g => (g as SVGColorGroup).elements);
      const transformedHtml = transformSvgElements(allElements, dimensions);
      const svgData = createFinalSvgString(transformedHtml);
      const dataUrl = `data:image/svg+xml;base64,${btoa(svgData)}`;

      return (
          <div className="w-full h-full flex justify-center items-center bg-[url('data:image/svg+xml,%3csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2032%2032%22%20width=%2232%22%20height=%2232%22%20fill=%22none%22%3e%3cpath%20d=%22M0%200h16v16H0zM16%2016h16v16H16z%22%20fill=%22%23475569%22/%3e%3c/svg%3e')] bg-repeat rounded-md">
              <img src={dataUrl} alt="Reassembled SVG preview" className="max-w-full max-h-full object-contain" />
          </div>
      );
    }
    
    // Raster Preview Effect
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !originalImageData || !dimensions || isSvgSource) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = dimensions.width;
        canvas.height = dimensions.height;

        const newImageData = ctx.createImageData(originalImageData.width, originalImageData.height);
        const data = originalImageData.data;
        const newData = newImageData.data;
        const maxDist = tolerance * 2.55;

        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 128) continue;
            
            const pixelColor = { r: data[i], g: data[i + 1], b: data[i + 2] };
            let bestGroupIndex = -1;
            let minDistance = Infinity;

            for (let j = 0; j < colorGroups.length; j++) {
                const dist = colorDistance(pixelColor, colorGroups[j].representativeColor);
                if (dist < minDistance) {
                    minDistance = dist;
                    bestGroupIndex = j;
                }
            }

            if (bestGroupIndex !== -1 && minDistance < maxDist) {
                const repColor = colorGroups[bestGroupIndex].representativeColor;
                newData[i] = repColor.r;
                newData[i + 1] = repColor.g;
                newData[i + 2] = repColor.b;
                newData[i + 3] = 255;
            } else {
                newData[i+3] = 0;
            }
        }
        ctx.putImageData(newImageData, 0, 0);
    }, [originalImageData, dimensions, colorGroups, tolerance, isSvgSource]);

    if (!isSvgSource) {
      return (
        <div className="w-full h-full flex justify-center items-center bg-[url('data:image/svg+xml,%3csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2032%2032%22%20width=%2232%22%22height=%2232%22%20fill=%22none%22%3e%3cpath%20d=%22M0%200h16v16H0zM16%2016h16v16H16z%22%20fill=%22%23475569%22/%3e%3c/svg%3e')] bg-repeat rounded-md">
             <canvas ref={canvasRef} className="max-w-full max-h-full object-contain"></canvas>
        </div>
      );
    }

    return null;
};


function App() {
  const [state, setState] = useState<AppState>(initialState);
  const {
    file,
    fileContent,
    tolerance,
    isLoading,
    error,
    colorGroups,
    dimensions,
    isSvgSource,
    originalImageData,
    isPreviewModalOpen,
    deletedGroups,
    editingGroup,
    reorderHistory,
    originalFilePreviewUrl,
    selectedGroupIndices,
    mergeHistory,
  } = state;

  const draggedItem = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const resetState = () => setState(initialState);
  
  const openPreviewModal = () => setState(s => ({ ...s, isPreviewModalOpen: true }));
  const closePreviewModal = () => setState(s => ({ ...s, isPreviewModalOpen: false }));

  const processImage = useCallback(async () => {
    if (!file || !fileContent) return;

    setState(s => ({ ...s, isLoading: true, error: null, colorGroups: [], deletedGroups: [], reorderHistory: [], selectedGroupIndices: [], mergeHistory: [] }));

    try {
      if (file.type === 'image/svg+xml') {
        const { groups, dimensions } = processSVG(fileContent, tolerance);
        setState(s => ({
          ...s,
          colorGroups: groups,
          dimensions,
          isSvgSource: true,
          originalImageData: null,
          isLoading: false,
        }));
      } else {
        const { groups, originalImageData, dimensions } = await processRaster(fileContent, tolerance);
        setState(s => ({
          ...s,
          colorGroups: groups,
          dimensions,
          isSvgSource: false,
          originalImageData,
          isLoading: false,
        }));
      }
    } catch (err) {
      console.error(err);
      setState(s => ({ ...s, isLoading: false, error: 'Failed to process the image. Please try another file.' }));
    }
  }, [file, fileContent, tolerance]);

  useEffect(() => {
    const handler = setTimeout(() => {
        if (file && fileContent) {
            processImage();
        }
    }, 300);

    return () => {
        clearTimeout(handler);
    };
  }, [tolerance, file, fileContent]); 

  const handleFileUpload = (uploadedFile: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) {
        setState(s => ({...s, error: 'Could not read file.'}));
        return;
      }
      
      let previewUrl = content; // For raster images, the content is the data URL
      if (uploadedFile.type === 'image/svg+xml') {
        previewUrl = `data:image/svg+xml;base64,${btoa(content)}`;
      }

      setState(s => ({
          ...initialState,
          file: uploadedFile,
          fileContent: content,
          isSvgSource: uploadedFile.type === 'image/svg+xml',
          tolerance: s.tolerance,
          originalFilePreviewUrl: previewUrl,
      }));
    };
    reader.onerror = () => setState(s => ({...s, error: 'Error reading file.'}));

    if (uploadedFile.type === 'image/svg+xml') {
        reader.readAsText(uploadedFile);
    } else if (uploadedFile.type.startsWith('image/')) {
        reader.readAsDataURL(uploadedFile);
    } else {
        setState(s => ({...s, error: 'Unsupported file type.'}));
    }
  };

  const handleToleranceChange = (value: number) => {
    setState(s => ({ ...s, tolerance: value }));
  };

  const downloadSvg = (group: SVGColorGroup, index: number) => {
    const transformedHtml = transformSvgElements(group.elements, dimensions);
    const svgData = createFinalSvgString(transformedHtml);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${index + 1}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const triggerPngDownload = (canvas: HTMLCanvasElement, index: number) => {
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${index + 1}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadPng = (group: SVGColorGroup | RasterColorGroup, index: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (isSvgSource) {
      const svgGroup = group as SVGColorGroup;
      const transformedHtml = transformSvgElements(svgGroup.elements, dimensions);
      const svgData = createFinalSvgString(transformedHtml);
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        triggerPngDownload(canvas, index);
      };
      img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
    } else if (originalImageData && dimensions) {
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      const rasterGroup = group as RasterColorGroup;
      const newImageData = ctx.createImageData(originalImageData.width, originalImageData.height);
      const data = originalImageData.data;
      const newData = newImageData.data;
      const groupIndex = colorGroups.findIndex(g => g.representativeColor === rasterGroup.representativeColor);
      const maxDist = tolerance * 2.55;

      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue;
        const pixelColor = { r: data[i], g: data[i + 1], b: data[i + 2] };
        let bestGroupIndex = -1;
        let minDistance = Infinity;
        for (let j = 0; j < colorGroups.length; j++) {
            const dist = colorDistance(pixelColor, colorGroups[j].representativeColor);
            if (dist < minDistance) { minDistance = dist; bestGroupIndex = j; }
        }
        if (bestGroupIndex === groupIndex && minDistance < maxDist) {
            newData[i] = data[i]; newData[i + 1] = data[i + 1]; newData[i + 2] = data[i + 2]; newData[i + 3] = data[i + 3];
        }
      }
      ctx.putImageData(newImageData, 0, 0);
      triggerPngDownload(canvas, index);
    }
  };

  const handleDownload = (group: SVGColorGroup | RasterColorGroup, format: 'svg' | 'png', index: number) => {
    if (format === 'svg' && isSvgSource) {
      downloadSvg(group as SVGColorGroup, index);
    } else {
      downloadPng(group, index);
    }
  };
  
  const handleDeleteGroup = (indexToDelete: number) => {
    const groupToDelete = colorGroups[indexToDelete];
    const newColorGroups = colorGroups.filter((_, index) => index !== indexToDelete);
    setState(s => ({
        ...s,
        colorGroups: newColorGroups,
        deletedGroups: [...s.deletedGroups, { group: groupToDelete, originalIndex: indexToDelete }],
        selectedGroupIndices: [],
    }));
  };

  const handleUndoDelete = () => {
    if (deletedGroups.length === 0) return;
    const newDeletedGroups = [...deletedGroups];
    const lastDeleted = newDeletedGroups.pop();
    if (lastDeleted) {
        const newColorGroups = [...colorGroups];
        const insertAt = Math.min(lastDeleted.originalIndex, newColorGroups.length);
        newColorGroups.splice(insertAt, 0, lastDeleted.group);
        setState(s => ({ ...s, colorGroups: newColorGroups, deletedGroups: newDeletedGroups }));
    }
  };
  
  const handleUndoReorder = () => {
    if (reorderHistory.length === 0) return;
    const newReorderHistory = [...reorderHistory];
    const lastState = newReorderHistory.pop();
    if (lastState) {
        setState(s => ({ ...s, colorGroups: lastState, reorderHistory: newReorderHistory }));
    }
  };

  const handleDragStart = (index: number) => draggedItem.current = index;
  const handleDragEnter = (index: number) => setDragOverIndex(index);
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        setDragOverIndex(null);
    }
  };
  const handleDrop = (dropIndex: number) => {
    if (draggedItem.current === null || draggedItem.current === dropIndex) {
        setDragOverIndex(null);
        return;
    };

    setState(s => {
      const newColorGroups = [...s.colorGroups];
      const draggedGroup = newColorGroups.splice(draggedItem.current!, 1)[0];
      newColorGroups.splice(dropIndex, 0, draggedGroup);
      return {
        ...s,
        colorGroups: newColorGroups,
        reorderHistory: [...s.reorderHistory, s.colorGroups],
        selectedGroupIndices: [],
      };
    });
    
    draggedItem.current = null;
    setDragOverIndex(null);
  };
  
  const handleOpenEditModal = (index: number) => {
    const group = colorGroups[index];
    if (isSvgSource && 'elements' in group) {
        setState(s => ({ ...s, editingGroup: { index, group: group as SVGColorGroup } }));
    }
  };
  
  const handleSaveEditedSvg = (newSvgString: string) => {
    if (!editingGroup) return;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(newSvgString, "image/svg+xml");
      if (doc.querySelector("parsererror")) {
        throw new Error("Invalid SVG syntax.");
      }
      const newElements = Array.from(doc.documentElement.childNodes).filter(node => node.nodeType === 1) as SVGElement[];
      
      const newColorGroups = [...colorGroups];
      const oldGroup = newColorGroups[editingGroup.index] as SVGColorGroup;
      newColorGroups[editingGroup.index] = { ...oldGroup, elements: newElements };
      
      setState(s => ({ ...s, colorGroups: newColorGroups, editingGroup: null, selectedGroupIndices: [] }));

    } catch (e) {
      alert(`Error saving SVG: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };
  
  const handleDownloadAllClick = async () => {
    if (!isSvgSource || !file) return;
    
    // @ts-ignore
    const zip = new JSZip();

    // Thumbnail
    const allElements = colorGroups.flatMap(g => (g as SVGColorGroup).elements);
    const transformedThumbnailHtml = transformSvgElements(allElements, dimensions);
    const thumbnailSvgData = `<svg width="600" height="600" viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/>${transformedThumbnailHtml}</svg>`;
    zip.file("thumb.svg", thumbnailSvgData);

    // Layers
    colorGroups.forEach((group, index) => {
      const transformedHtml = transformSvgElements((group as SVGColorGroup).elements, dimensions);
      const svgData = createFinalSvgString(transformedHtml);
      zip.file(`${index + 1}.svg`, svgData);
    });
    
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(zipBlob);
    link.download = `${file.name.split('.').slice(0, -1).join('.') || 'archive'}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const handleSelectGroup = (indexToToggle: number) => {
    setState(s => {
        const newSelection = [...s.selectedGroupIndices];
        const existingIndex = newSelection.indexOf(indexToToggle);
        if (existingIndex > -1) {
            newSelection.splice(existingIndex, 1);
        } else {
            newSelection.push(indexToToggle);
        }
        return { ...s, selectedGroupIndices: newSelection };
    });
  };

  const handleMergeGroups = () => {
    if (selectedGroupIndices.length < 2) return;

    const groupsToMerge = selectedGroupIndices.map(i => colorGroups[i]);

    let newMergedGroup: SVGColorGroup | RasterColorGroup;

    if (isSvgSource) {
      const svgGroups = groupsToMerge as SVGColorGroup[];
      const primaryGroup = [...svgGroups].sort((a, b) => b.elements.length - a.elements.length)[0];
      const allElements = svgGroups.flatMap(g => g.elements);
      newMergedGroup = {
        representativeColor: primaryGroup.representativeColor,
        elements: allElements,
      };
    } else {
      const rasterGroups = groupsToMerge as RasterColorGroup[];
      const primaryGroup = [...rasterGroups].sort((a, b) => b.totalCount - a.totalCount)[0];
      const allMemberColors = rasterGroups.flatMap(g => g.memberColors);
      const totalCount = rasterGroups.reduce((sum, g) => sum + g.totalCount, 0);
      newMergedGroup = {
        representativeColor: primaryGroup.representativeColor,
        memberColors: allMemberColors,
        totalCount: totalCount,
      };
    }

    const indicesToRemove = new Set(selectedGroupIndices);
    const newColorGroups = colorGroups.filter((_, index) => !indicesToRemove.has(index));
    const insertAtIndex = Math.min(...selectedGroupIndices);
    newColorGroups.splice(insertAtIndex, 0, newMergedGroup);
    
    setState(s => ({
        ...s,
        colorGroups: newColorGroups,
        mergeHistory: [...s.mergeHistory, s.colorGroups],
        selectedGroupIndices: [],
        deletedGroups: [],
        reorderHistory: [],
    }));
  };

  const handleUndoMerge = () => {
    if (mergeHistory.length === 0) return;
    const newMergeHistory = [...mergeHistory];
    const lastState = newMergeHistory.pop();
    if (lastState) {
        setState(s => ({ ...s, colorGroups: lastState, mergeHistory: newMergeHistory }));
    }
  };


  const renderContent = () => {
    if (isLoading && colorGroups.length === 0) { return <Loader message="Analyzing your image..." />; }
    if (error) {
      return (
        <div className="text-center">
          <p className="text-red-400">{error}</p>
          <button onClick={resetState} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Try again</button>
        </div>
      );
    }
    if (!file) { return <FileUpload onFileUpload={handleFileUpload} />; }
    return (
      <div className="space-y-8">
        <div><ToleranceSlider value={tolerance} onChange={handleToleranceChange} disabled={isLoading} /></div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-lg font-semibold text-gray-300 mb-2 text-center">Original Input</h3>
            <div className="aspect-square bg-gray-800 p-2 rounded-lg border border-gray-700 flex items-center justify-center">
              {originalFilePreviewUrl && (
                <img src={originalFilePreviewUrl} alt="Original file preview" className="max-w-full max-h-full object-contain" />
              )}
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-300 mb-2 text-center">Live Reassembled Thumbnail</h3>
             <div className="aspect-square bg-gray-800 p-2 rounded-lg border border-gray-700">
                <ReassembledPreview 
                    isSvgSource={isSvgSource} 
                    colorGroups={colorGroups} 
                    dimensions={dimensions} 
                    originalImageData={originalImageData} 
                    tolerance={tolerance}
                />
             </div>
          </div>
        </div>
        
        {isLoading && <Loader message="Recalculating colors..." />}
        {!isLoading && colorGroups.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 pt-8">
            {colorGroups.map((group, index) => {
              const previewDataUrl = isSvgSource
                ? `data:image/svg+xml;base64,${btoa(createFinalSvgString(transformSvgElements((group as SVGColorGroup).elements, dimensions)))}`
                : undefined;
              
              return (
              <div
                key={group.representativeColor.r + group.representativeColor.g + group.representativeColor.b + index}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragEnter={() => handleDragEnter(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(index)}
                onDragLeave={handleDragLeave}
                className={`transition-opacity ${dragOverIndex === index ? 'opacity-50' : ''}`}
              >
                <ColorGroupCard
                  group={group}
                  isSvgSource={isSvgSource}
                  previewDataUrl={previewDataUrl}
                  onDownload={(format) => handleDownload(group, format, index)}
                  onDelete={() => handleDeleteGroup(index)}
                  onEdit={() => handleOpenEditModal(index)}
                  isSelected={selectedGroupIndices.includes(index)}
                  onSelect={() => handleSelectGroup(index)}
                />
              </div>
            )})}
          </div>
        ) : !isLoading && (
          <div className="text-center text-gray-500 py-10">
             <p>No color groups found. Try increasing tolerance or undoing a delete.</p>
          </div>
        )}
         <p className="text-center text-gray-500 text-sm pt-4">Drag & drop to reorder layers. Extract color stencils from your images.</p>
      </div>
    );
  };

  return (
    <div className="bg-gray-900 text-white min-h-screen">
      <header className="bg-gray-800/50 backdrop-blur-sm sticky top-0 z-10 border-b border-gray-700">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
                <PackageIcon className="h-8 w-8 text-indigo-400" />
                <h1 className="ml-3 text-2xl font-bold text-gray-200">Image Color Extractor</h1>
            </div>
            {file && (
                <button onClick={resetState} className="px-4 py-2 text-sm font-medium text-indigo-400 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500">
                    Start Over
                </button>
            )}
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28">
        {renderContent()}
      </main>
      
      {(colorGroups.length > 0 || deletedGroups.length > 0 || reorderHistory.length > 0 || mergeHistory.length > 0) && (
        <div className="fixed bottom-0 left-0 right-0 z-20 bg-gray-800/90 backdrop-blur-sm border-t border-gray-700 shadow-lg">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-center flex-wrap gap-4">
            {selectedGroupIndices.length === 1 && (
               <div className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-center text-gray-400 bg-gray-800 rounded-lg border border-gray-700">
                 <MergeIcon className="w-5 h-5 mr-2 text-purple-400" />
                 <span>Select more layers to merge</span>
               </div>
            )}
            {selectedGroupIndices.length >= 2 && (
               <button onClick={handleMergeGroups} disabled={isLoading} className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-center text-white bg-purple-600 rounded-lg hover:bg-purple-700 focus:ring-4 focus:outline-none focus:ring-purple-300 disabled:bg-gray-500">
                 <MergeIcon className="w-5 h-5 mr-2" /> Merge Selected
               </button>
            )}
            {isSvgSource && colorGroups.length > 0 && (
              <button onClick={handleDownloadAllClick} disabled={isLoading} className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-center text-white bg-green-600 rounded-lg hover:bg-green-700 focus:ring-4 focus:outline-none focus:ring-green-300 disabled:bg-gray-500">
                <PackageIcon className="w-5 h-5 mr-2" /> Download All (ZIP)
              </button>
            )}
            {colorGroups.length > 0 && (
            <button onClick={openPreviewModal} disabled={isLoading} className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-center text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 disabled:bg-gray-500">
              <EyeIcon className="w-5 h-5 mr-2" /> Preview Fullscreen
            </button>
            )}
             {mergeHistory.length > 0 && (
              <button onClick={handleUndoMerge} disabled={isLoading} className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-center text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 focus:ring-4 focus:outline-none focus:ring-cyan-300 disabled:bg-gray-500">
                <UndoIcon className="w-5 h-5 mr-2" /> Undo Merge
              </button>
            )}
            {reorderHistory.length > 0 && (
              <button onClick={handleUndoReorder} disabled={isLoading} className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-center text-white bg-orange-600 rounded-lg hover:bg-orange-700 focus:ring-4 focus:outline-none focus:ring-orange-300 disabled:bg-gray-500">
                <UndoIcon className="w-5 h-5 mr-2" /> Undo Reorder
              </button>
            )}
            {deletedGroups.length > 0 && (
              <button onClick={handleUndoDelete} disabled={isLoading} className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-center text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 focus:ring-4 focus:outline-none focus:ring-yellow-300 disabled:bg-gray-500">
                <UndoIcon className="w-5 h-5 mr-2" /> Undo Delete
              </button>
            )}
          </div>
        </div>
      )}
      
      <PreviewModal isOpen={isPreviewModalOpen} onClose={closePreviewModal} title="Reassembled Preview">
        {isPreviewModalOpen && <ReassembledPreview isSvgSource={isSvgSource} colorGroups={colorGroups} dimensions={dimensions} originalImageData={originalImageData} tolerance={tolerance}/>}
      </PreviewModal>
      {editingGroup && (
        <SvgEditModal
            isOpen={!!editingGroup}
            onClose={() => setState(s => ({...s, editingGroup: null}))}
            onSave={handleSaveEditedSvg}
            initialSvgContent={createFinalSvgString(
                (editingGroup.group as SVGColorGroup).elements.map(el => el.outerHTML).join('')
            )}
        />
      )}
    </div>
  );
}

export default App;

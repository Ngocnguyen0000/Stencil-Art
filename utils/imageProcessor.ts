import type { RGBColor, SVGPathData, SVGColorGroup, RasterColorGroup, ImageDimensions } from '../types';
import { colorDistance, parseColorString } from './colorUtils';

export function processSVG(
  svgText: string,
  tolerance: number
): { groups: SVGColorGroup[]; dimensions: ImageDimensions } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const svgElement = doc.documentElement as unknown as SVGSVGElement;

  // Sử dụng một div ẩn để lấy các style đã được tính toán, giúp xử lý đúng CSS và kế thừa từ các thẻ <g> hoặc thẻ <svg> gốc.
  const hiddenDiv = document.createElement('div');
  hiddenDiv.style.visibility = 'hidden';
  hiddenDiv.style.position = 'absolute';
  hiddenDiv.style.width = '0';
  hiddenDiv.style.height = '0';
  hiddenDiv.style.overflow = 'hidden';
  document.body.appendChild(hiddenDiv);
  hiddenDiv.appendChild(svgElement);
  
  const viewBox = svgElement.getAttribute('viewBox');
  let width = svgElement.width.baseVal.value;
  let height = svgElement.height.baseVal.value;

  // Nếu width/height không được thiết lập, thử lấy chúng từ viewBox
  if (viewBox && (width === 0 || height === 0)) {
    const viewBoxParts = viewBox.split(/[ ,]+/).map(parseFloat);
    if (viewBoxParts.length === 4) {
      width = viewBoxParts[2];
      height = viewBoxParts[3];
    }
  }

  const dimensions = { width, height, viewBox };

  const paths: SVGPathData[] = [];
  // Chọn tất cả các phần tử định hình. Các style được tính toán của chúng sẽ phản ánh bất kỳ thuộc tính kế thừa nào.
  const elements = svgElement.querySelectorAll('path, rect, circle, ellipse, polygon, polyline, line');

  elements.forEach(el => {
    const style = window.getComputedStyle(el);
    let fill = parseColorString(style.fill);
    const isWhite = fill && fill.r === 255 && fill.g === 255 && fill.b === 255;

    if (isWhite) {
      fill = { r: 247, g: 247, b: 247 }; // Corresponds to #F7F7F7
    }
    
    // Một thuộc tính opacity không xác định sẽ mặc định là 1. Điều này xử lý đúng opacity="0".
    const fillOpacity = isNaN(parseFloat(style.fillOpacity)) ? 1 : parseFloat(style.fillOpacity);
    
    // Chỉ xử lý các phần tử có màu tô hiển thị. Các đường viền (stroke) bị bỏ qua theo yêu cầu.
    if (fill && fillOpacity > 0) {
      const clonedElement = el.cloneNode(true) as SVGElement;
      
      // If the original color was white, explicitly set the new fill color on the clone.
      if (isWhite) {
        clonedElement.setAttribute('fill', '#F7F7F7');
      }
      
      // Theo yêu cầu, đảm bảo tất cả các đường viền được loại bỏ khỏi các lớp đầu ra.
      clonedElement.setAttribute('stroke', 'none');
      
      paths.push({ color: fill, element: clonedElement });
    }
  });

  document.body.removeChild(hiddenDiv);
  
  const groups: SVGColorGroup[] = [];
  const maxDist = tolerance * 2.55; // Điều chỉnh dung sai thành khoảng cách màu thực tế

  paths.forEach(path => {
    let placed = false;
    for (const group of groups) {
      if (colorDistance(path.color, group.representativeColor) < maxDist) {
        group.elements.push(path.element);
        placed = true;
        break;
      }
    }
    if (!placed) {
      groups.push({
        representativeColor: path.color,
        elements: [path.element],
      });
    }
  });

  // Thứ tự của các nhóm được xác định bởi thứ tự xuất hiện màu trong tài liệu SVG.
  // Không còn sắp xếp theo sự chiếm ưu thế.

  return { groups, dimensions };
}

export function processRaster(
  imageDataUrl: string,
  tolerance: number
): Promise<{ groups: RasterColorGroup[]; originalImageData: ImageData, dimensions: ImageDimensions }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      const data = imageData.data;
      const colorMap: { [key: string]: { color: RGBColor; count: number } } = {};
      
      // Lấy mẫu pixel để tăng hiệu suất
      const sampleRate = Math.max(1, Math.floor(Math.sqrt(data.length / 4) / 1000));

      for (let i = 0; i < data.length; i += 4 * sampleRate) {
        if (data[i + 3] < 128) continue; // Bỏ qua các pixel trong suốt
        const color = { r: data[i], g: data[i + 1], b: data[i + 2] };
        const key = `${color.r},${color.g},${color.b}`;
        if (!colorMap[key]) {
          colorMap[key] = { color, count: 0 };
        }
        colorMap[key].count++;
      }

      const sortedColors = Object.values(colorMap).sort((a, b) => b.count - a.count);

      const groups: RasterColorGroup[] = [];
      const maxDist = tolerance * 2.55;

      sortedColors.forEach((colorData) => {
        let placed = false;
        for (const group of groups) {
          if (colorDistance(colorData.color, group.representativeColor) < maxDist) {
            group.memberColors.push(colorData.color);
            group.totalCount += colorData.count;
            placed = true;
            break;
          }
        }
        if (!placed) {
          groups.push({
            representativeColor: colorData.color,
            memberColors: [colorData.color],
            totalCount: colorData.count,
          });
        }
      });
      
      // Sắp xếp các nhóm cuối cùng theo sự chiếm ưu thế (tổng số pixel)
      groups.sort((a, b) => b.totalCount - a.totalCount);

      resolve({ groups, originalImageData: imageData, dimensions: { width: img.width, height: img.height, viewBox: `0 0 ${img.width} ${img.height}` } });
    };
    img.src = imageDataUrl;
  });
}

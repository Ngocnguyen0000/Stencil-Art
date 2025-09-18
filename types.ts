
export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export interface SVGPathData {
  color: RGBColor;
  element: SVGElement;
}

export interface SVGColorGroup {
  representativeColor: RGBColor;
  elements: SVGElement[];
}

export interface RasterColorGroup {
  representativeColor: RGBColor;
  memberColors: RGBColor[];
  totalCount: number;
}

export interface ImageDimensions {
  width: number;
  height: number;
  viewBox: string | null;
}
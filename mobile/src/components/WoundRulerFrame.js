import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, Dimensions, TouchableOpacity } from 'react-native';
import Svg, { Line, Text as SvgText, Rect, G } from 'react-native-svg';
import { Ruler, Eye, EyeOff } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Mobile WoundRulerFrame
 * Renders high-precision Top, Bottom, Left, and Right calibrated centimeter scales using SVG.
 */
export default function WoundRulerFrame({
  imageUri,
  pixelsPerCm = null,
  measurements = null,
  title = "Tissue Segmentation Map",
}) {
  const [showCalipers, setShowCalipers] = useState(true);
  const [imgLayout, setImgLayout] = useState({ width: SCREEN_WIDTH - 64, height: (SCREEN_WIDTH - 64) * 0.8 });
  const [naturalSize, setNaturalSize] = useState({ width: 400, height: 400 });

  const TOP_RULER_H = 28;
  const BOTTOM_RULER_H = 28;
  const LEFT_RULER_W = 36;
  const RIGHT_RULER_W = 36;

  // On Image load, get natural dimensions
  const onImageLoad = (e) => {
    const { width, height } = e.nativeEvent.source;
    if (width && height) {
      setNaturalSize({ width, height });
      const aspect = height / width;
      const displayW = SCREEN_WIDTH - 48 - (LEFT_RULER_W + RIGHT_RULER_W);
      const displayH = Math.min(360, displayW * aspect);
      setImgLayout({ width: displayW, height: displayH });
    }
  };

  const scaleFactorX = imgLayout.width / (naturalSize.width || 1);
  const scaleFactorY = imgLayout.height / (naturalSize.height || 1);

  const totalWidthCm = pixelsPerCm ? naturalSize.width / pixelsPerCm : null;
  const totalHeightCm = pixelsPerCm ? naturalSize.height / pixelsPerCm : null;

  // Bounding box for caliper lines
  const bbox = measurements?.bbox; // [x, y, w, h] in natural image px
  const hasBbox = Array.isArray(bbox) && bbox.length === 4 && bbox[2] > 0 && bbox[3] > 0;

  const bboxDisplay = hasBbox ? {
    x: bbox[0] * scaleFactorX,
    y: bbox[1] * scaleFactorY,
    w: bbox[2] * scaleFactorX,
    h: bbox[3] * scaleFactorY,
    x2: (bbox[0] + bbox[2]) * scaleFactorX,
    y2: (bbox[1] + bbox[3]) * scaleFactorY,
  } : null;

  const woundWidthCm = (hasBbox && pixelsPerCm) ? (bbox[2] / pixelsPerCm).toFixed(2) : null;
  const woundHeightCm = (hasBbox && pixelsPerCm) ? (bbox[3] / pixelsPerCm).toFixed(2) : null;

  // Horizontal Ticks (Top & Bottom)
  const renderHorizontalTicks = (isTop = true) => {
    const ticks = [];
    if (pixelsPerCm && totalWidthCm) {
      const maxCm = Math.ceil(totalWidthCm);
      const pxPerCmDisplay = pixelsPerCm * scaleFactorX;

      for (let cm = 0; cm <= maxCm; cm += 0.5) {
        const roundedCm = Math.round(cm * 10) / 10;
        const xPos = roundedCm * pxPerCmDisplay;
        if (xPos > imgLayout.width) break;

        const isMajor = Math.abs(roundedCm - Math.round(roundedCm)) < 0.01;

        if (isMajor) {
          ticks.push(
            <G key={`h-maj-${roundedCm}`} transform={`translate(${xPos}, 0)`}>
              <Line
                x1="0"
                y1={isTop ? TOP_RULER_H - 10 : 0}
                x2="0"
                y2={isTop ? TOP_RULER_H : 10}
                stroke="#facc15"
                strokeWidth="1.5"
              />
              <SvgText
                x="0"
                y={isTop ? TOP_RULER_H - 13 : 21}
                textAnchor="middle"
                fontSize="9"
                fontWeight="bold"
                fill="#f8fafc"
              >
                {Math.round(roundedCm)}
              </SvgText>
            </G>
          );
        } else {
          ticks.push(
            <Line
              key={`h-half-${roundedCm}`}
              x1={xPos}
              y1={isTop ? TOP_RULER_H - 6 : 0}
              x2={xPos}
              y2={isTop ? TOP_RULER_H : 6}
              stroke="#94a3b8"
              strokeWidth="1"
            />
          );
        }
      }
    } else {
      // Percentage Fallback
      for (let p = 0; p <= 100; p += 25) {
        const xPos = (p / 100) * imgLayout.width;
        ticks.push(
          <G key={`h-pct-${p}`} transform={`translate(${xPos}, 0)`}>
            <Line
              x1="0"
              y1={isTop ? TOP_RULER_H - 6 : 0}
              x2="0"
              y2={isTop ? TOP_RULER_H : 6}
              stroke="#94a3b8"
              strokeWidth="1"
            />
            <SvgText
              x="0"
              y={isTop ? TOP_RULER_H - 10 : 18}
              textAnchor="middle"
              fontSize="8"
              fill="#cbd5e1"
            >
              {p}%
            </SvgText>
          </G>
        );
      }
    }
    return ticks;
  };

  // Vertical Ticks (Left & Right)
  const renderVerticalTicks = (isLeft = true) => {
    const ticks = [];
    if (pixelsPerCm && totalHeightCm) {
      const maxCm = Math.ceil(totalHeightCm);
      const pxPerCmDisplay = pixelsPerCm * scaleFactorY;

      for (let cm = 0; cm <= maxCm; cm += 0.5) {
        const roundedCm = Math.round(cm * 10) / 10;
        const yPos = roundedCm * pxPerCmDisplay;
        if (yPos > imgLayout.height) break;

        const isMajor = Math.abs(roundedCm - Math.round(roundedCm)) < 0.01;

        if (isMajor) {
          ticks.push(
            <G key={`v-maj-${roundedCm}`} transform={`translate(0, ${yPos})`}>
              <Line
                x1={isLeft ? LEFT_RULER_W - 10 : 0}
                y1="0"
                x2={isLeft ? LEFT_RULER_W : 10}
                y2="0"
                stroke="#facc15"
                strokeWidth="1.5"
              />
              <SvgText
                x={isLeft ? LEFT_RULER_W - 13 : 14}
                y="3"
                textAnchor={isLeft ? "end" : "start"}
                fontSize="9"
                fontWeight="bold"
                fill="#f8fafc"
              >
                {Math.round(roundedCm)}
              </SvgText>
            </G>
          );
        } else {
          ticks.push(
            <Line
              key={`v-half-${roundedCm}`}
              x1={isLeft ? LEFT_RULER_W - 6 : 0}
              y1={yPos}
              x2={isLeft ? LEFT_RULER_W : 6}
              y2={yPos}
              stroke="#94a3b8"
              strokeWidth="1"
            />
          );
        }
      }
    } else {
      for (let p = 0; p <= 100; p += 25) {
        const yPos = (p / 100) * imgLayout.height;
        ticks.push(
          <G key={`v-pct-${p}`} transform={`translate(0, ${yPos})`}>
            <Line
              x1={isLeft ? LEFT_RULER_W - 6 : 0}
              y1="0"
              x2={isLeft ? LEFT_RULER_W : 6}
              y2="0"
              stroke="#94a3b8"
              strokeWidth="1"
            />
            <SvgText
              x={isLeft ? LEFT_RULER_W - 10 : 12}
              y="3"
              textAnchor={isLeft ? "end" : "start"}
              fontSize="8"
              fill="#cbd5e1"
            >
              {p}%
            </SvgText>
          </G>
        );
      }
    }
    return ticks;
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ruler size={16} color="#facc15" />
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
        {hasBbox && (
          <TouchableOpacity
            style={[styles.caliperBtn, showCalipers && styles.caliperBtnActive]}
            onPress={() => setShowCalipers(!showCalipers)}
          >
            {showCalipers ? <Eye size={14} color="#06b6d4" /> : <EyeOff size={14} color="#94a3b8" />}
            <Text style={[styles.caliperBtnText, showCalipers && styles.caliperBtnTextActive]}>
              {showCalipers ? "Calipers ON" : "Calipers OFF"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 4-Sided Frame Grid */}
      <View style={styles.frameContainer}>
        {/* Top Row: [Corner] [Top Ruler] [Corner] */}
        <View style={styles.horizontalRow}>
          <View style={[styles.cornerBox, { width: LEFT_RULER_W, height: TOP_RULER_H }]}>
            <Text style={styles.unitText}>{pixelsPerCm ? "cm" : "%"}</Text>
          </View>
          <View style={{ width: imgLayout.width, height: TOP_RULER_H, backgroundColor: '#0f172a' }}>
            <Svg width={imgLayout.width} height={TOP_RULER_H}>
              {renderHorizontalTicks(true)}
              {showCalipers && bboxDisplay && (
                <G>
                  <Rect x={bboxDisplay.x} y={TOP_RULER_H - 4} width={bboxDisplay.w} height={4} fill="#06b6d4" />
                  <Line x1={bboxDisplay.x} y1={0} x2={bboxDisplay.x} y2={TOP_RULER_H} stroke="#06b6d4" strokeWidth="1.5" />
                  <Line x1={bboxDisplay.x2} y1={0} x2={bboxDisplay.x2} y2={TOP_RULER_H} stroke="#06b6d4" strokeWidth="1.5" />
                </G>
              )}
            </Svg>
          </View>
          <View style={[styles.cornerBox, { width: RIGHT_RULER_W, height: TOP_RULER_H }]}>
            <Text style={styles.cornerSubText}>0</Text>
          </View>
        </View>

        {/* Center Row: [Left Ruler] [Image with Overlays] [Right Ruler] */}
        <View style={styles.horizontalRow}>
          {/* Left Ruler */}
          <View style={{ width: LEFT_RULER_W, height: imgLayout.height, backgroundColor: '#0f172a' }}>
            <Svg width={LEFT_RULER_W} height={imgLayout.height}>
              {renderVerticalTicks(true)}
              {showCalipers && bboxDisplay && (
                <G>
                  <Rect x={LEFT_RULER_W - 4} y={bboxDisplay.y} width={4} height={bboxDisplay.h} fill="#06b6d4" />
                  <Line x1={0} y1={bboxDisplay.y} x2={LEFT_RULER_W} y2={bboxDisplay.y} stroke="#06b6d4" strokeWidth="1.5" />
                  <Line x1={0} y1={bboxDisplay.y2} x2={LEFT_RULER_W} y2={bboxDisplay.y2} stroke="#06b6d4" strokeWidth="1.5" />
                </G>
              )}
            </Svg>
          </View>

          {/* Center Image */}
          <View style={{ width: imgLayout.width, height: imgLayout.height, backgroundColor: '#000' }}>
            <Image
              source={{ uri: imageUri }}
              style={{ width: imgLayout.width, height: imgLayout.height }}
              resizeMode="contain"
              onLoad={onImageLoad}
            />

            {/* Caliper Projection Lines Overlay */}
            {showCalipers && bboxDisplay && (
              <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
                {/* Horizontal projection lines */}
                <Line x1={0} y1={bboxDisplay.y} x2={imgLayout.width} y2={bboxDisplay.y} stroke="#06b6d4" strokeWidth="1" strokeDasharray="3,3" />
                <Line x1={0} y1={bboxDisplay.y2} x2={imgLayout.width} y2={bboxDisplay.y2} stroke="#06b6d4" strokeWidth="1" strokeDasharray="3,3" />

                {/* Vertical projection lines */}
                <Line x1={bboxDisplay.x} y1={0} x2={bboxDisplay.x} y2={imgLayout.height} stroke="#06b6d4" strokeWidth="1" strokeDasharray="3,3" />
                <Line x1={bboxDisplay.x2} y1={0} x2={bboxDisplay.x2} y2={imgLayout.height} stroke="#06b6d4" strokeWidth="1" strokeDasharray="3,3" />
              </Svg>
            )}
          </View>

          {/* Right Ruler */}
          <View style={{ width: RIGHT_RULER_W, height: imgLayout.height, backgroundColor: '#0f172a' }}>
            <Svg width={RIGHT_RULER_W} height={imgLayout.height}>
              {renderVerticalTicks(false)}
              {showCalipers && bboxDisplay && (
                <G>
                  <Rect x={0} y={bboxDisplay.y} width={4} height={bboxDisplay.h} fill="#06b6d4" />
                  <Line x1={0} y1={bboxDisplay.y} x2={RIGHT_RULER_W} y2={bboxDisplay.y} stroke="#06b6d4" strokeWidth="1.5" />
                  <Line x1={0} y1={bboxDisplay.y2} x2={RIGHT_RULER_W} y2={bboxDisplay.y2} stroke="#06b6d4" strokeWidth="1.5" />
                </G>
              )}
            </Svg>
          </View>
        </View>

        {/* Bottom Row: [Corner] [Bottom Ruler] [Corner] */}
        <View style={styles.horizontalRow}>
          <View style={[styles.cornerBox, { width: LEFT_RULER_W, height: BOTTOM_RULER_H }]}>
            <Text style={styles.cornerSubText}>0</Text>
          </View>
          <View style={{ width: imgLayout.width, height: BOTTOM_RULER_H, backgroundColor: '#0f172a' }}>
            <Svg width={imgLayout.width} height={BOTTOM_RULER_H}>
              {renderHorizontalTicks(false)}
              {showCalipers && bboxDisplay && (
                <G>
                  <Rect x={bboxDisplay.x} y={0} width={bboxDisplay.w} height={4} fill="#06b6d4" />
                  <Line x1={bboxDisplay.x} y1={0} x2={bboxDisplay.x} y2={BOTTOM_RULER_H} stroke="#06b6d4" strokeWidth="1.5" />
                  <Line x1={bboxDisplay.x2} y1={0} x2={bboxDisplay.x2} y2={BOTTOM_RULER_H} stroke="#06b6d4" strokeWidth="1.5" />
                </G>
              )}
            </Svg>
          </View>
          <View style={[styles.cornerBox, { width: RIGHT_RULER_W, height: BOTTOM_RULER_H }]}>
            <Text style={styles.unitText}>{pixelsPerCm ? "cm" : "%"}</Text>
          </View>
        </View>
      </View>

      {/* Footer Metrics */}
      <View style={styles.footer}>
        {woundWidthCm && woundHeightCm ? (
          <Text style={styles.footerText}>
            Wound Extent: <Text style={styles.boldCyan}>{woundWidthCm} cm (W)</Text> × <Text style={styles.boldCyan}>{woundHeightCm} cm (H)</Text>
          </Text>
        ) : (
          <Text style={styles.footerMuted}>Scale calibration active. Ticks are in centimeters.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
    marginVertical: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
  },
  caliperBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#334155',
  },
  caliperBtnActive: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderWidth: 1,
    borderColor: '#06b6d4',
  },
  caliperBtnText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  caliperBtnTextActive: {
    color: '#06b6d4',
  },
  frameContainer: {
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  horizontalRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cornerBox: {
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: '#334155',
  },
  unitText: {
    color: '#facc15',
    fontSize: 10,
    fontWeight: '900',
  },
  cornerSubText: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '600',
  },
  footer: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  footerText: {
    fontSize: 12,
    color: '#e2e8f0',
  },
  footerMuted: {
    fontSize: 11,
    color: '#94a3b8',
  },
  boldCyan: {
    color: '#22d3ee',
    fontWeight: 'bold',
  },
});

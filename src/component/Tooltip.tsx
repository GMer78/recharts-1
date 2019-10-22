/**
 * @fileOverview Tooltip
 */
import React, { PureComponent, CSSProperties, ReactNode, ReactElement, ReactText } from 'react';
// @ts-ignore
import { translateStyle } from 'react-smooth';
import _ from 'lodash';
import classNames from 'classnames';
import DefaultTooltipContent from './DefaultTooltipContent';
import { ValueType, Payload, Props as DefaultProps } from './DefaultTooltipContent'
// @ts-ignore
import { isSsr } from '../util/ReactUtils';
// @ts-ignore
import { isNumber } from '../util/DataUtils';
import { AnimationTiming } from '../util/types';

const CLS_PREFIX = 'recharts-tooltip-wrapper';

const EPS = 1;
export type ContentType<TValue extends ValueType, TName> = ReactElement | ((props: Props<TValue, TName>) => ReactNode)

type UniqueFunc<TValue extends ValueType, TName> = (entry: Payload<TValue, TName>) => unknown
type UniqueOption<TValue extends ValueType, TName> = boolean | UniqueFunc<TValue, TName>;
function defaultUniqBy<TValue extends ValueType, TName>(entry: Payload<TValue, TName>) { return entry.dataKey };
function getUniqPayload<TValue extends ValueType, TName>(option: UniqueOption<TValue, TName>, payload: Array<Payload<TValue, TName>>) {
  if (option === true) {
    return _.uniqBy(payload, defaultUniqBy);
  }

  if (_.isFunction(option)) {
    return _.uniqBy(payload, option);
  }

  return payload;
};

function renderContent<TValue extends ValueType, TName>(content: ContentType<TValue, TName>, props: Props<TValue, TName>) {
  if (React.isValidElement(content)) {
    return React.cloneElement(content, props);
  } if (_.isFunction(content)) {
    return content(props);
  }

  return <DefaultTooltipContent {...props} />
};

type Props<TValue extends ValueType, TName> = DefaultProps<TValue, TName> & {
  allowEscapeViewBox?: {
    x?: boolean;
    y?: boolean;
  };
  content?: ContentType<TValue, TName>
  viewBox?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
  active?: boolean;
  offset?: number;
  wrapperStyle?: CSSProperties;
  cursor?: boolean | ReactElement | {
    strokeDasharray: ReactText;
    stroke?: string;
  };
  coordinate?: {
    x?: number;
    y?: number;
  }
  position?: {
    x?: number;
    y?: number;
  }
  payloadUniqBy: UniqueOption<TValue, TName>;
  isAnimationActive?: boolean;
  animationDuration?: number;
  animationEasing?: AnimationTiming;
  filterNull?: boolean;
  useTranslate3d?: boolean;
}

class Tooltip<TValue extends ValueType, TName> extends PureComponent<Props<TValue, TName>> {
  static displayName = 'Tooltip';
  static defaultProps = {
    active: false,
    allowEscapeViewBox: { x: false, y: false },
    offset: 10,
    viewBox: { x1: 0, x2: 0, y1: 0, y2: 0 },
    coordinate: { x: 0, y: 0 },
    cursorStyle: {},
    separator: ' : ',
    wrapperStyle: {},
    contentStyle: {},
    itemStyle: {},
    labelStyle: {},
    cursor: true,
    isAnimationActive: !isSsr(),
    animationEasing: 'ease',
    animationDuration: 400,
    filterNull: true,
    useTranslate3d: false,
  };

  state = {
    boxWidth: -1,
    boxHeight: -1,
  };

  private wrapperNode: HTMLDivElement;

  componentDidMount() {
    this.updateBBox();
  }

  componentDidUpdate() {
    this.updateBBox();
  }

  updateBBox() {
    const { boxWidth, boxHeight } = this.state;

    if (this.wrapperNode && this.wrapperNode.getBoundingClientRect) {
      const box = this.wrapperNode.getBoundingClientRect();

      if (Math.abs(box.width - boxWidth) > EPS || Math.abs(box.height - boxHeight) > EPS) {
        this.setState({
          boxWidth: box.width,
          boxHeight: box.height,
        });
      }
    } else if (boxWidth !== -1 || boxHeight !== -1) {
      this.setState({
        boxWidth: -1,
        boxHeight: -1,
      });
    }
  }

  getTranslate = ({ key, tooltipDimension, viewBoxDimension }: {
    key: 'x' | 'y';
    tooltipDimension: number;
    viewBoxDimension: number;
  }) => {
    const { allowEscapeViewBox, coordinate, offset, position, viewBox } = this.props;

    if (position && isNumber(position[key])) {
      return position[key];
    }

    const restricted = coordinate[key] - tooltipDimension - offset;
    const unrestricted = coordinate[key] + offset;
    if (allowEscapeViewBox[key]) {
      return unrestricted;
    }

    const tooltipBoundary = coordinate[key] + tooltipDimension + offset;
    const viewBoxBoundary = viewBox[key] + viewBoxDimension;
    if (tooltipBoundary > viewBoxBoundary) {
      return Math.max(restricted, viewBox[key]);
    }
    return Math.max(unrestricted, viewBox[key]);
  };

  render() {
    const { payload, isAnimationActive, animationDuration, animationEasing,
      filterNull, payloadUniqBy } = this.props;
    const finalPayload = getUniqPayload(payloadUniqBy, filterNull && payload && payload.length ?
      payload.filter(entry => !_.isNil(entry.value)) : payload);
    const hasPayload = finalPayload && finalPayload.length;
    const { content, viewBox, coordinate, position, active, wrapperStyle } = this.props;
    let outerStyle: CSSProperties = {
      pointerEvents: 'none',
      visibility: active && hasPayload ? 'visible' : 'hidden',
      position: 'absolute',
      top: 0,
      ...wrapperStyle,
    };
    let translateX, translateY;

    if (position && isNumber(position.x) && isNumber(position.y)) {
      translateX = position.x;
      translateY = position.y;
    } else {
      const { boxWidth, boxHeight } = this.state;

      if (boxWidth > 0 && boxHeight > 0 && coordinate) {
        translateX = this.getTranslate({
          key: 'x',
          tooltipDimension: boxWidth,
          viewBoxDimension: viewBox.width,
        });

        translateY = this.getTranslate({
          key: 'y',
          tooltipDimension: boxHeight,
          viewBoxDimension: viewBox.height,
        });
      } else {
        outerStyle.visibility = 'hidden';
      }
    }

    outerStyle = {
      ...translateStyle({
        transform: this.props.useTranslate3d ? `translate3d(${translateX}px, ${translateY}px, 0)` : `translate(${translateX}px, ${translateY}px)`,
      }),
      ...outerStyle,
    };

    if (isAnimationActive && active) {
      outerStyle = {
        ...translateStyle({
          transition: `transform ${animationDuration}ms ${animationEasing}`,
        }),
        ...outerStyle,
      };
    }

    const cls = classNames(CLS_PREFIX, {
      [`${CLS_PREFIX}-right`]: isNumber(translateX) && coordinate && isNumber(coordinate.x) && translateX >= coordinate.x,
      [`${CLS_PREFIX}-left`]: isNumber(translateX) && coordinate && isNumber(coordinate.x) && translateX < coordinate.x,
      [`${CLS_PREFIX}-bottom`]: isNumber(translateY) && coordinate && isNumber(coordinate.y) && translateY >= coordinate.y,
      [`${CLS_PREFIX}-top`]: isNumber(translateY) && coordinate && isNumber(coordinate.y) && translateY < coordinate.y,
    });

    return (
      <div
        className={cls}
        style={outerStyle}
        ref={(node) => { this.wrapperNode = node; }}
      >
        {renderContent(content, { ...this.props, payload: finalPayload })}
      </div>
    );
  }
}

export default Tooltip;
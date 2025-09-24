/**
 * パフォーマンス監視カスタムフック
 * Web Performance API と Firebase Analytics を活用
 */

import { useCallback, useEffect, useRef } from 'react';
import { logger } from '../services/logger';

// 将来の拡張用のインターフェース
// interface PerformanceMetrics {
//   renderTime?: number;
//   loadTime?: number;
//   interactionTime?: number;
//   memoryUsage?: number;
// }

interface PerformanceMonitorOptions {
  component?: string;
  threshold?: number; // ms
  trackMemory?: boolean;
}

export const usePerformanceMonitor = (
  componentName: string,
  options: PerformanceMonitorOptions = {}
) => {
  const {
    threshold = 100,
    trackMemory = false
  } = options;

  const renderStartTime = useRef<number>(performance.now());
  const mountTime = useRef<number>(0);

  // コンポーネントマウント時の計測開始
  useEffect(() => {
    mountTime.current = performance.now();

    return () => {
      // アンマウント時のクリーンアップログ
      logger.debug(`Component unmounted: ${componentName}`, {
        component: 'performance',
        action: 'component_unmount',
        componentName
      });
    };
  }, [componentName]);

  // レンダー時間の計測
  const measureRenderTime = useCallback(() => {
    const renderEndTime = performance.now();
    const renderDuration = renderEndTime - renderStartTime.current;

    if (renderDuration > threshold) {
      logger.performance(`Slow render detected: ${componentName}`, renderDuration, {
        component: 'performance',
        componentName,
        renderDuration,
        threshold
      });
    } else {
      logger.debug(`Render time: ${componentName}`, {
        component: 'performance',
        componentName,
        renderDuration
      });
    }

    // 次回のレンダー時間計測のためにリセット
    renderStartTime.current = performance.now();

    return renderDuration;
  }, [componentName, threshold]);

  // 非同期操作の時間計測
  const measureAsyncOperation = useCallback(async <T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> => {
    const startTime = performance.now();

    try {
      const result = await operation();
      const duration = performance.now() - startTime;

      logger.performance(`${operationName} completed`, duration, {
        component: 'performance',
        componentName,
        operationName,
        status: 'success'
      });

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;

      logger.performance(`${operationName} failed`, duration, {
        component: 'performance',
        componentName,
        operationName,
        status: 'error'
      });

      throw error;
    }
  }, [componentName]);

  // ユーザーインタラクションの時間計測
  const measureInteraction = useCallback((
    interactionName: string,
    startTime: number = performance.now()
  ) => {
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;

      logger.performance(`Interaction: ${interactionName}`, duration, {
        component: 'performance',
        componentName,
        interactionName,
        interactionDuration: duration
      });

      if (duration > threshold) {
        logger.warn(`Slow interaction detected: ${interactionName}`, {
          component: 'performance',
          componentName,
          interactionName,
          duration,
          threshold
        });
      }

      return duration;
    };
  }, [componentName, threshold]);

  // メモリ使用量の監視
  const checkMemoryUsage = useCallback(() => {
    if (!trackMemory || !('memory' in performance)) {
      return null;
    }

    const memory = (performance as { memory: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
    const memoryUsage = {
      used: Math.round(memory.usedJSHeapSize / 1024 / 1024), // MB
      total: Math.round(memory.totalJSHeapSize / 1024 / 1024), // MB
      limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024) // MB
    };

    // メモリ使用量が80%を超えた場合は警告
    const usagePercentage = (memoryUsage.used / memoryUsage.limit) * 100;
    if (usagePercentage > 80) {
      logger.warn(`High memory usage detected: ${usagePercentage.toFixed(1)}%`, {
        component: 'performance',
        componentName,
        memoryUsage,
        usagePercentage
      });
    } else {
      logger.debug(`Memory usage: ${componentName}`, {
        component: 'performance',
        componentName,
        memoryUsage
      });
    }

    return memoryUsage;
  }, [componentName, trackMemory]);

  // Web Vitals の監視
  const measureWebVitals = useCallback(() => {
    // Largest Contentful Paint (LCP)
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];

      logger.performance('LCP measured', lastEntry.startTime, {
        component: 'performance',
        metric: 'lcp',
        value: lastEntry.startTime
      });
    });

    try {
      observer.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch {
      // LCP not supported
      logger.debug('LCP monitoring not supported', {
        component: 'performance'
      });
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  // リソース読み込み時間の監視
  const measureResourceLoadTimes = useCallback(() => {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const slowResources = resources.filter((resource) => resource.duration > 1000);

    if (slowResources.length > 0) {
      slowResources.forEach((resource) => {
        logger.warn(`Slow resource load detected: ${resource.name}`, {
          component: 'performance',
          resourceName: resource.name,
          duration: resource.duration,
          resourceType: resource.initiatorType
        });
      });
    }

    logger.debug(`Resource monitoring: ${componentName}`, {
      component: 'performance',
      componentName,
      totalResources: resources.length,
      slowResources: slowResources.length
    });
  }, [componentName]);

  return {
    measureRenderTime,
    measureAsyncOperation,
    measureInteraction,
    checkMemoryUsage,
    measureWebVitals,
    measureResourceLoadTimes
  };
};

export default usePerformanceMonitor;
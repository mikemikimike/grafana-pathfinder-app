import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import { InteractiveLearningBanner, clearBannerImpressionCache } from './InteractiveLearningBanner';
import { testIds } from '../../constants/testIds';
import { StorageKeys } from '../../lib/storage-keys';
import { AnalyticsContentType, UserInteraction } from '../../lib/analytics';

const mockEnroll = jest.fn();
jest.mock('../../utils/experiments/interactive-learning-banner', () => ({
  enrollInteractiveLearningBannerExperiment: () => mockEnroll(),
}));

const mockReportAppInteraction = jest.fn();
jest.mock('../../lib/analytics', () => ({
  ...jest.requireActual('../../lib/analytics'),
  reportAppInteraction: (...args: unknown[]) => mockReportAppInteraction(...args),
}));

const dismissalKey = `${StorageKeys.INTERACTIVE_LEARNING_BANNER_DISMISSED_PREFIX}${window.location.hostname}`;
const GUIDE_URL = 'bundled:welcome-to-interactive-learning';

describe('InteractiveLearningBanner', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    clearBannerImpressionCache();
    mockEnroll.mockReturnValue({ variant: 'treatment' });
  });

  it.each(['control', 'excluded'])('renders nothing for the %s arm', (variant) => {
    mockEnroll.mockReturnValue({ variant });
    render(<InteractiveLearningBanner onOpenGuide={jest.fn()} />);

    expect(screen.queryByTestId(testIds.contextPanel.interactiveLearningBanner)).not.toBeInTheDocument();
    expect(mockReportAppInteraction).not.toHaveBeenCalled();
  });

  it('renders the banner and reports an impression for the treatment arm', () => {
    render(<InteractiveLearningBanner onOpenGuide={jest.fn()} />);

    expect(screen.getByTestId(testIds.contextPanel.interactiveLearningBanner)).toBeInTheDocument();
    expect(screen.getByTestId(testIds.contextPanel.interactiveLearningBannerCta)).toBeInTheDocument();
    expect(mockReportAppInteraction).toHaveBeenCalledWith(UserInteraction.InteractiveLearningBannerShown, {
      interaction_location: 'interactive_learning_banner',
    });
  });

  it('reports one impression per page load, not per remount', () => {
    const first = render(<InteractiveLearningBanner onOpenGuide={jest.fn()} />);
    first.unmount();
    render(<InteractiveLearningBanner onOpenGuide={jest.fn()} />);

    const impressions = mockReportAppInteraction.mock.calls.filter(
      (call) => call[0] === UserInteraction.InteractiveLearningBannerShown
    );
    expect(impressions).toHaveLength(1);
  });

  it('stays hidden when it was dismissed on a previous page load', () => {
    localStorage.setItem(dismissalKey, 'true');
    render(<InteractiveLearningBanner onOpenGuide={jest.fn()} />);

    expect(screen.queryByTestId(testIds.contextPanel.interactiveLearningBanner)).not.toBeInTheDocument();
  });

  it('persists the dismissal and reports it when the close control is used', () => {
    render(<InteractiveLearningBanner onOpenGuide={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));

    expect(screen.queryByTestId(testIds.contextPanel.interactiveLearningBanner)).not.toBeInTheDocument();
    expect(localStorage.getItem(dismissalKey)).toBe('true');
    expect(mockReportAppInteraction).toHaveBeenCalledWith(UserInteraction.InteractiveLearningBannerDismissed, {
      interaction_location: 'interactive_learning_banner',
    });
  });

  it('opens the bundled guide from the CTA', () => {
    const onOpenGuide = jest.fn();
    render(<InteractiveLearningBanner onOpenGuide={onOpenGuide} />);

    fireEvent.click(screen.getByTestId(testIds.contextPanel.interactiveLearningBannerCta));

    expect(onOpenGuide).toHaveBeenCalledWith(GUIDE_URL, 'How interactive learning works');
  });

  it('reports the CTA as a normal guide open so it lands in the existing funnel', () => {
    render(<InteractiveLearningBanner onOpenGuide={jest.fn()} />);
    fireEvent.click(screen.getByTestId(testIds.contextPanel.interactiveLearningBannerCta));

    expect(mockReportAppInteraction).toHaveBeenCalledWith(UserInteraction.OpenResourceClick, {
      content_title: 'How interactive learning works',
      content_url: GUIDE_URL,
      content_type: AnalyticsContentType.InteractiveGuide,
      interaction_location: 'interactive_learning_banner',
    });
  });

  it('degrades to a visible banner when localStorage is unavailable', () => {
    const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });

    render(<InteractiveLearningBanner onOpenGuide={jest.fn()} />);
    expect(screen.getByTestId(testIds.contextPanel.interactiveLearningBanner)).toBeInTheDocument();

    getItem.mockRestore();
  });
});

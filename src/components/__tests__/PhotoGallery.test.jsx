import { render, screen, fireEvent } from '@testing-library/react';
import PhotoGallery from '../PhotoGallery';

const photos = ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg', 'f.jpg'];
const viewerImage = () => screen.getByRole('dialog').querySelector('img');

describe('PhotoGallery', () => {
  it('shows one row of thumbnails with a +N tile, then expands to all', () => {
    render(<PhotoGallery photos={photos} />);
    expect(screen.getAllByRole('button', { name: /Open photo/ })).toHaveLength(2);
    expect(screen.getByText('+3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show all 6 photos' }));
    expect(screen.getAllByRole('button', { name: /Open photo/ })).toHaveLength(6);
    expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument();
  });

  it('expands when the +N tile is tapped', () => {
    render(<PhotoGallery photos={photos} />);
    fireEvent.click(screen.getByText('+3'));
    expect(screen.getAllByRole('button', { name: /Open photo/ })).toHaveLength(6);
  });

  it('opens the viewer at the tapped photo and moves with arrows, keys and swipes', () => {
    render(<PhotoGallery photos={photos} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open photo 2 of 6' }));
    expect(viewerImage()).toHaveAttribute('src', 'b.jpg');
    expect(screen.getByText('2 / 6')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next photo' }));
    expect(viewerImage()).toHaveAttribute('src', 'c.jpg');

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(viewerImage()).toHaveAttribute('src', 'b.jpg');

    const stage = viewerImage().parentElement;
    fireEvent.touchStart(stage, { touches: [{ clientX: 300 }] });
    fireEvent.touchEnd(stage, { changedTouches: [{ clientX: 100 }] }); // swipe left -> next
    expect(viewerImage()).toHaveAttribute('src', 'c.jpg');

    fireEvent.touchStart(stage, { touches: [{ clientX: 100 }] });
    fireEvent.touchEnd(stage, { changedTouches: [{ clientX: 300 }] }); // swipe right -> previous
    expect(viewerImage()).toHaveAttribute('src', 'b.jpg');
  });

  it('wraps around from the first photo to the last', () => {
    render(<PhotoGallery photos={photos} />);
    fireEvent.click(screen.getByRole('button', { name: 'View full screen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous photo' }));
    expect(viewerImage()).toHaveAttribute('src', 'f.jpg');
  });

  it('closes with Escape and the close button', () => {
    render(<PhotoGallery photos={photos} />);
    fireEvent.click(screen.getByRole('button', { name: 'View full screen' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'View full screen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close photo viewer' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('handles a single photo string and no photos', () => {
    const { rerender } = render(<PhotoGallery photos="only.jpg" />);
    expect(screen.queryByRole('button', { name: /Show all/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open photo 1 of 1' }));
    expect(screen.queryByRole('button', { name: 'Next photo' })).not.toBeInTheDocument();

    rerender(<PhotoGallery photos={[]} />);
    expect(screen.getByText('No photos attached.')).toBeInTheDocument();
  });

  it('closes with the large CLOSE button', () => {
    render(<PhotoGallery photos={photos} />);
    fireEvent.click(screen.getByRole('button', { name: 'View full screen' }));
    fireEvent.click(screen.getByRole('button', { name: 'CLOSE' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('reads photo lists stored as JSON text', () => {
    render(<PhotoGallery photos='["x.jpg","y.jpg"]' />);
    expect(screen.getAllByRole('button', { name: /Open photo/ })).toHaveLength(2);
  });

  it('drops photos that fail to load', () => {
    render(<PhotoGallery photos={['ok.jpg', 'broken.jpg']} />);
    const broken = screen.getByRole('button', { name: 'Open photo 2 of 2' }).querySelector('img');
    fireEvent.error(broken);
    expect(screen.getAllByRole('button', { name: /Open photo/ })).toHaveLength(1);
  });

  it('renders nothing for no photos when emptyText is null', () => {
    const { container } = render(<PhotoGallery photos={null} emptyText={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

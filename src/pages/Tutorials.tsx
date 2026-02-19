import { MainLayout } from '@/components/layout/MainLayout';
import { TutorialLibrary } from '@/components/tutorials/TutorialLibrary';

export default function Tutorials() {
  return (
    <MainLayout 
      title="Video Tutorials" 
      subtitle="Learn how to get the most out of FieldTek"
    >
      <TutorialLibrary />
    </MainLayout>
  );
}

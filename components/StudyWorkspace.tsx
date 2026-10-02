'use client';

import React, { useState } from 'react';
import { OFFICIAL_NCERT_RESOURCES, CURRICULUM_DATA } from '@/lib/studyData';
import { StudyResource } from '@/lib/firebase';
import {
  BookOpen,
  Search,
  ExternalLink,
  Sparkles,
  FileText,
  ListOrdered,
  ChevronRight,
  Bookmark,
  CheckCircle2,
  Atom,
  Calculator,
  Globe,
  Share2,
} from 'lucide-react';
import { sound } from '@/lib/sound';

interface StudyWorkspaceProps {
  initialSubject?: string;
  initialClass?: string;
  onBackToQuiz?: () => void;
}

export const StudyWorkspace: React.FC<StudyWorkspaceProps> = ({
  initialSubject = 'Science',
  initialClass = 'Class 10',
  onBackToQuiz,
}) => {
  const [selectedClass, setSelectedClass] = useState(initialClass);
  const [selectedSubject, setSelectedSubject] = useState(initialSubject);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResource, setSelectedResource] = useState<StudyResource>(OFFICIAL_NCERT_RESOURCES[0]);
  const [activeTab, setActiveTab] = useState<'summary' | 'keyPoints' | 'formulas' | 'examples'>('summary');

  // Filtered resources
  const filteredResources = OFFICIAL_NCERT_RESOURCES.filter((res) => {
    const matchesClass = selectedClass === 'All' || res.classLevel === selectedClass;
    const matchesSubject = selectedSubject === 'All' || res.subject.toLowerCase() === selectedSubject.toLowerCase();
    const matchesSearch =
      !searchQuery.trim() ||
      res.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.chapter.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.description.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesClass && matchesSubject && matchesSearch;
  });

  return (
    <div className="flex flex-col h-full bg-slate-950 rounded-2xl border border-indigo-500/20 overflow-hidden text-white shadow-2xl">
      {/* Top Header */}
      <div className="p-3 sm:p-4 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>NCERT Educational Library</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Official Curriculum
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Verified NCERT chapter notes, formulas, and textbook references
            </p>
          </div>
        </div>

        {onBackToQuiz && (
          <button
            onClick={() => {
              sound.playClick();
              onBackToQuiz();
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-all flex items-center gap-1"
          >
            <span>Back to Live Quiz</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="px-4 py-3 bg-slate-900/60 border-b border-slate-800 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chapters, concepts, formulas..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <select
          value={selectedClass}
          onChange={(e) => {
            sound.playClick();
            setSelectedClass(e.target.value);
          }}
          className="px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
        >
          <option value="All">All Classes</option>
          <option value="Class 10">Class 10</option>
          <option value="Class 12">Class 12</option>
          <option value="Class 9">Class 9</option>
          <option value="Class 11">Class 11</option>
        </select>

        <select
          value={selectedSubject}
          onChange={(e) => {
            sound.playClick();
            setSelectedSubject(e.target.value);
          }}
          className="px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
        >
          <option value="All">All Subjects</option>
          <option value="Science">Science</option>
          <option value="Physics">Physics</option>
          <option value="Chemistry">Chemistry</option>
          <option value="Mathematics">Mathematics</option>
        </select>
      </div>

      {/* Main Study Grid */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Chapters list sidebar */}
        <div className="w-full md:w-72 max-h-52 md:max-h-full bg-slate-950/70 border-b md:border-b-0 md:border-r border-slate-800/80 p-3 overflow-y-auto space-y-2 shrink-0">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">
            Available Chapters ({filteredResources.length})
          </p>

          {filteredResources.map((res) => (
            <button
              key={res.id}
              onClick={() => {
                sound.playClick();
                setSelectedResource(res);
              }}
              className={`w-full text-left p-2.5 rounded-xl border transition-all text-xs flex flex-col gap-1 ${
                selectedResource?.id === res.id
                  ? 'bg-purple-600/20 border-purple-500 text-white shadow-md'
                  : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-bold truncate text-slate-200">{res.title}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300">
                  {res.classLevel}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 truncate">{res.subject}</span>
            </button>
          ))}

          {filteredResources.length === 0 && (
            <div className="py-8 text-center text-xs text-slate-500">
              No matching NCERT chapters found. Try clearing filters.
            </div>
          )}
        </div>

        {/* Resource Details & Reader */}
        {selectedResource ? (
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-950/40">
            {/* Chapter Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 space-y-2 bg-slate-900/30">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-xs text-indigo-400 font-semibold">
                  <span>{selectedResource.book}</span>
                  <span>•</span>
                  <span>{selectedResource.chapter}</span>
                </div>

                <div className="flex items-center gap-2">
                  {selectedResource.pdfUrl && (
                    <a
                      href={selectedResource.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/40 transition-colors flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Official PDF</span>
                    </a>
                  )}
                </div>
              </div>

              <h2 className="text-xl font-black text-white">{selectedResource.title}</h2>
              <p className="text-xs text-slate-400">{selectedResource.description}</p>

              {/* Sub-tabs */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80 overflow-x-auto no-scrollbar">
                {(['summary', 'keyPoints', 'formulas', 'examples'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      sound.playClick();
                      setActiveTab(t);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all ${
                      activeTab === t
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {t === 'keyPoints' ? 'Key Points' : t === 'formulas' ? 'Formulas' : t === 'examples' ? 'Examples' : 'Summary'}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs leading-relaxed text-slate-300">
              {activeTab === 'summary' && (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-indigo-500/20 text-slate-200 space-y-2">
                    <h4 className="font-bold text-white text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      Chapter Summary
                    </h4>
                    <p className="text-xs leading-relaxed text-slate-300">
                      {selectedResource.summary}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                    <h4 className="font-bold text-white text-xs">Official NCERT Source:</h4>
                    <p className="text-slate-400">{selectedResource.source}</p>
                    <p className="text-[11px] text-slate-500">
                      All curriculum content is aligned with national education board standards for school assessments.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'keyPoints' && (
                <div className="space-y-2.5">
                  <h4 className="font-bold text-white text-sm mb-3">Core Educational Takeaways</h4>
                  {selectedResource.keyPoints.map((pt, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-start gap-3"
                    >
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-400 font-bold text-[10px] shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <p className="text-slate-200">{pt}</p>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'formulas' && (
                <div className="space-y-3">
                  <h4 className="font-bold text-white text-sm mb-2 flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-indigo-400" />
                    Essential Equations & Formulas
                  </h4>
                  {selectedResource.keyFormulas && selectedResource.keyFormulas.length > 0 ? (
                    selectedResource.keyFormulas.map((formula, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/30 font-mono text-indigo-200 text-xs tracking-wide shadow-sm"
                      >
                        {formula}
                      </div>
                    ))
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-900 text-slate-500">
                      This chapter focuses on qualitative conceptual foundations. Refer to Key Points.
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'examples' && (
                <div className="space-y-3">
                  <h4 className="font-bold text-white text-sm mb-2">Curriculum Solved Examples</h4>
                  {selectedResource.solvedExamples && selectedResource.solvedExamples.length > 0 ? (
                    selectedResource.solvedExamples.map((ex, idx) => (
                      <div key={idx} className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                        <p className="font-bold text-white">Q: {ex.question}</p>
                        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 text-emerald-300">
                          <p className="font-semibold text-emerald-400 mb-1">Solution:</p>
                          <p>{ex.solution}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-900 text-slate-500">
                      Standard questions for this chapter are available in the live quiz arena!
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
            Select a chapter from the list to view its educational notes.
          </div>
        )}
      </div>
    </div>
  );
};

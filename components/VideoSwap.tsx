<div className="w-full p-6 bg-gray-800/50 border border-gray-700 rounded-xl">
            <h2 className="text-xl text-center font-bold text-cyan-400 mb-4">2. 영상 설명</h2>
            
            {/* Motion Templates */}
            <div className="mb-4">
              <label className="block mb-2 text-sm font-medium text-gray-300">모션 템플릿</label>
              <select
                value={selectedTemplate}
                onChange={handleTemplateChange}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-blue-500 focus:border-blue-500 transition"
              >
                <option value="">직접 입력</option>
                <option value="smile">자연스러운 미소</option>
                <option value="wink">윙크</option>
                <option value="headTurn">고개 돌리기</option>
                <option value="hairFlow">바람에 날리는 머리</option>
                <option value="laugh">웃는 표정</option>
                <option value="talk">말하는 모습</option>
                <option value="nod">고개 끄덕이기</option>
                <option value="blink">자연스러운 눈 깜빡임</option>
              </select>
            </div>

            {/* Custom Prompt */}
            <textarea
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                setSelectedTemplate('');
              }}
              placeholder="예: 머리를 좌우로 흔들며 웃는 모습, 윙크하는 모습, 바람에 머리카락이 날리는 모습"
              className="w-full h-32 p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 transition resize-none"
              disabled={!!selectedTemplate}
            />
            
            <button
              onClick={handleGenerateVideo}
              disabled={isLoading || !originalImage || (!prompt && !selectedTemplate)}
              className="w-full mt-4 flex items-center justify-center px-6 py-3.5 text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg hover:from-blue-700 hover:to-cyan-700 focus:ring-4 focus:outline-none focus:ring-blue-800 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-300"
            >
              {isLoading ? (
                '처리 중...'
              ) : (
                <>
                  <VideoIcon className="w-5 h-5 mr-2" />
                  영상 생성하기
                </>
              )}
            </button>
          </div>

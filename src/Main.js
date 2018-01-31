import React, { Component } from 'react'
import {
  BrowserRouter as Router,
  Route,
  Switch,
  withRouter,
} from 'react-router-dom'
import { decode } from 'he'

import Header from './components/Header'
import Playlists from './containers/Playlists'
import Playlist from './containers/Playlist'
import Player from './components/Player'

import { classifyItemURL } from './lib/helpers'
import { tinyAPI } from './lib/api'

const playerStatus = {
  idle: 'IDLE',
  buffering: 'BUFFERING',
  playing: 'PLAYING',
  errored: 'ERRORED'
}

class Main extends Component {
  constructor(props) {
    super(props)
    this.state = {
      activePage: 1,
      playlistListLength: 0,
      per: 20,
      playlistChannel: null,
      searchList: null,
      isPlaying: false,
      currentTrackURL: null,
      indexOfCurrentTrack: 0,
      currentOpenPlaylist: null,
      currentTrackPlaylist: null,
      maxItemsInCurrentPage: 0,
      volume: 0.8,
      trackProgress: 0,
      trackDuration: 0,
      isCurrentPlaylistLoaded: false,
      playerStatus: playerStatus.idle,
      currentTrackInfo: null,
      trackIsFromCurrentPlaylist: true,
      searchQuery: '',
      currentRoute: '/',
    }
    this.API = new tinyAPI()
    this.playerRef = null
  }

  // get list of playlists and playlist list length. also attach invert event
  componentWillMount() {
    window.addEventListener('keydown', (e) => this.handleInvert(e))
    Promise.all([
      this.API.getBlockCount(),
      this.API.getChannelContents(),
    ])
      .then(([length, playlistChannel]) => {
        const resortedPlaylists = {
          ...playlistChannel,
          contents: playlistChannel.contents.reverse()
        }
        this.setState({
          playlistListLength: length,
          playlistChannel: resortedPlaylists,
          searchList: playlistChannel,
        })
      })
  }

  togglePlaylistOrder = (resortedPlaylists) => {
    this.setState({ resortedPlaylists: resortedPlaylists.reverse() })
  }

  applySearch = (predicate) => {
    const updatedList = this.state.playlistChannel.contents.filter(item => {
      const text = decode(`${item.user.full_name} / ${item.title}`)
      return text.toLowerCase().search(predicate) !== -1
    })
    this.setState({ searchList: { ...this.state.playlistChannel, contents: updatedList } })
  }

  setQueryInState = (event) => {
    this.setState({ searchQuery: event.target.value })
  }

  // mhm
  handleInvert = (e) => {
    if (e.shiftKey && e.ctrlKey && e.code === 'KeyI') {
      document.body.classList.toggle('invert')
    }
  }

  // i don't really get why this needs to happen, something to do with
  // specifically how pagination works
  // one issue right now is that the playlistListPromise returns # of all channels
  // including private channels ( i think )
  getMaxItemsInCurrentPage = (length, per) => {
    return Math.ceil(length / this.state.per)
  }

  // toggle function for playing and pausing with 1 UI element. Plays 1st track
  // of playlist if pressed and nothing has been played yet
  handlePlayback = () => {
    const {
      currentRoute,
      currentOpenPlaylist,
      isPlaying,
      currentTrackURL
    } = this.state
    if (currentRoute === '/playlist/:playlistSlug' && !currentTrackURL) {
      const item = currentOpenPlaylist.contents[0]
      this.handleSongSelection(item, 0)
    } else if (currentRoute === '/playlist/:playlistSlug' || currentTrackURL) {
      isPlaying ? this.pause() : this.play()
    }
  }

  // currently any time a track is selected, it will be played.
  handleSongSelection = (item, indexOfCurrentTrack) => {
    this.setState({
      currentTrackURL: classifyItemURL(item),
      indexOfCurrentTrack,
      currentTrackInfo: item,
      trackIsFromCurrentPlaylist: true,
      currentTrackPlaylist: this.state.currentOpenPlaylist
    })
    this.play()
  }


  // determines if the currently playing/paused track is from the currently
  // displayed playlist
  isTrackIsFromCurrentPlaylist = (pl1, pl2) => {
    if (pl1 && pl2) {
      return pl1.id === pl2.id ? true : false
    } else {
      return true
    }
  }

  play = () => {
    this.setState({ isPlaying: true, })
  }

  pause = () => {
    this.setState({ isPlaying: false, playerStatus: playerStatus.idle })
  }

  // if we select a playlist, get it's contents.
  // then, set it as the current open playlist
  returnSelectedPlaylist = (playlistSlug) => {
    this.setState({isCurrentPlaylistLoaded: false})
    this.API.getFullChannel(playlistSlug)
      .then(playlist => {
        const { currentTrackPlaylist } = this.state
        this.setState({
          currentOpenPlaylist: playlist,
          isCurrentPlaylistLoaded: true,
          trackIsFromCurrentPlaylist: this.isTrackIsFromCurrentPlaylist(currentTrackPlaylist, playlist)
        })
      })
  }

  // update +1 track and index
  goToNextTrack = () => {
    const { indexOfCurrentTrack, currentTrackPlaylist } = this.state
    if (indexOfCurrentTrack + 1 < currentTrackPlaylist.length) {
      const nextIndex = indexOfCurrentTrack + 1
      const nextTrack = currentTrackPlaylist.contents[nextIndex]
      this.handleSongSelection(nextTrack, nextIndex)
    }
  }

  //  update -1 track and index
  goToPreviousTrack = () => {
    const { indexOfCurrentTrack, currentTrackPlaylist } = this.state
    if (indexOfCurrentTrack > 0) {
      const previousIndex = indexOfCurrentTrack - 1
      const previousTrack = currentTrackPlaylist.contents[previousIndex]
      this.handleSongSelection(previousTrack, previousIndex)
    } else if (indexOfCurrentTrack === 0) {
      this.playerRef.seekTo(0)
    }
  }

  returnFullRoute = (currentRoute) => {
    this.setState({currentRoute})
  }

  handleOnReady = (e) => {
    // console.log(e, 'ready')
  }

  handleOnStart = (e) => {
    // console.log(e, 'start')
  }

  handleOnPlay = (e) => {
    this.setState({playerStatus: playerStatus.playing })
  }

  handleOnProgress = (e) => {
    this.setState({ trackProgress: e.playedSeconds })
  }

  handleOnDuration = (e) => {
    this.setState({ trackDuration: e })
  }

  handleOnBuffer = (e) => {
    this.setState({playerStatus: playerStatus.buffering })
  }

  handleOnError = (e) => {
    this.setState({playerStatus: playerStatus.errored })
    this.goToNextTrack()
  }

  returnRef = (ref) => {
    this.playerRef = ref
  }

  render () {
    return (
      <Router>
        <div className={'w-100 min-vh-100 pa3 pa5-ns'}>
          <HeaderWithRouter
            currentRoute={'/'}
            currentOpenPlaylist={this.state.currentOpenPlaylist}
            isCurrentPlaylistLoaded={this.state.isCurrentPlaylistLoaded}
          />
          <Player
            ref={this.ref}
            handlePlayback={this.handlePlayback}
            isPlaying={this.state.isPlaying}
            currentTrackURL={this.state.currentTrackURL}
            goToNextTrack={this.goToNextTrack}
            goToPreviousTrack={this.goToPreviousTrack}
            volume={this.state.volume}
            handleOnReady={this.handleOnReady}
            handleOnStart={this.handleOnStart}
            handleOnPlay={this.handleOnPlay}
            handleOnProgress={this.handleOnProgress}
            handleOnDuration={this.handleOnDuration}
            handleOnBuffer={this.handleOnBuffer}
            handleOnError={this.handleOnError}
            trackProgress={this.state.trackProgress}
            trackDuration={this.state.trackDuration}
            currentTrackInfo={this.state.currentTrackInfo}
            currentTrackPlaylist={this.state.currentTrackPlaylist}
            trackIsFromCurrentPlaylist={this.state.trackIsFromCurrentPlaylist}
            playerStatus={this.state.playerStatus}
            currentRoute={this.state.currentRoute}
            returnRef={this.returnRef}
           />
          <Switch>
            <PropsRoute
              exact path={'/'}
              component={Playlists}
              listLength={this.state.maxItemsInCurrentPage}
              playlistChannel={this.state.playlistChannel}
              searchList={this.state.searchList}
              applySearch={this.applySearch}
              activePage={this.state.activePage}
              handlePlaylistSelect={this.handlePlaylistSelect}
              returnFullRoute={this.returnFullRoute}
              searchQuery={this.state.searchQuery}
              setQueryInState={this.setQueryInState}
              // handlePaginatedPageNav={(event, selectedEvent) => this.handlePaginatedPageNav(event, selectedEvent)} />
              />
            <PropsRoute
              path={'/playlist/:playlistSlug'}
              component={Playlist}
              isPlaying={this.state.isPlaying}
              isCurrentPlaylistLoaded={this.state.isCurrentPlaylistLoaded}
              currentOpenPlaylist={this.state.currentOpenPlaylist}
              handleSongSelection={this.handleSongSelection}
              trackIsFromCurrentPlaylist={this.state.trackIsFromCurrentPlaylist}
              indexOfCurrentTrack={this.state.indexOfCurrentTrack}
              returnSelectedPlaylist={this.returnSelectedPlaylist}
              returnFullRoute={this.returnFullRoute}
              currentTrackInfo={this.state.currentTrackInfo} />
          </Switch>
        </div>
      </Router>
    )
  }
}

// we need router info from <Router /> in header but header is not a route
const HeaderWithRouter = withRouter(props => <Header {...props}/>)

// this takes props from <PropsRoute /> and passes them in a new
// object to the wrapped component
const renderMergedProps = (component, ...mePropsies) => {
  const finalProps = Object.assign({}, ...mePropsies)
  return (
    React.createElement(component, finalProps)
  )
}

// this component serves as a wrapper that allows props to be passed into routes
// this is why we can use one local state for most of the app
const PropsRoute = ({ component, ...mePropsies }) => {
  return (
    <Route key={mePropsies.location.key} {...mePropsies} render={routeProps => {
      return renderMergedProps(component, routeProps, mePropsies)
    }}/>
  )
}


export default Main

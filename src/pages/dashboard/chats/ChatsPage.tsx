import React, { ChangeEvent, useContext, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { getAdminUserData, getChannel, getChats, hasAdminUserData, saveChats } from '../../../services/user-storage';
import { toast } from 'sonner';
import { ArrowDown2, ArrowRight2, Call, CloseCircle, DocumentText, EmojiHappy, Image, Microphone, Music, Paperclip, PlayCircle, Send,Video, VideoPlay } from 'iconsax-react';
import { markChatAsRead, sendAttachment, sendChat, websocket_url } from '../../../services/api-consumer';
import { Chat } from '../../../interfaces/Chat';
import { useMutation } from '@tanstack/react-query';
import { ApiResponse } from '../../../interfaces/ApiResponse';
import { FaSpinner } from 'react-icons/fa6';
import { Client } from '@stomp/stompjs';
import { Channel } from '../../../interfaces/Channel';
import ChatWidget, { TypingWidget } from './ChatWidget';
import { Admin } from '../../../interfaces/Admin';
import docsPurple from "../../../assets/lottie/doc-purple.json"
import LottieWidget from "../../../components/LottieWidget"
import PopupMenu from '../../../components/PopupMenu/PopupMenu';
import PopupTarget from '../../../components/PopupMenu/PopupTarget';
import { User } from '../../../interfaces/User';
import { delay } from '../../../services/delay';
import OverlappingImages from '../../../components/OverlappingImages';
import { useCall, useStreamVideoClient } from '@stream-io/video-react-sdk';
import { useAppSelector } from '../../../hooks/redux-hook';
import { useCustomStreamCall } from '../../../hooks/stream-call-hook';
import { CallContext } from '../CallLayout';
import { useDirectMessage } from '../../../provider/DirectMessagesProvider';
import { useAdmin } from '../../../provider/AdminProvider';
import { useChats } from '../../../provider/ChatsProvider';
import { DirectMessage } from '../../../interfaces/DirectMessage';
import { useStompClient } from '../../../provider/StompClientContext';
import { useTypingIndicator } from '../../../provider/TypingIndicatorProvider';

// Where chatting is taking place.
export default function ChatsPage() {
  const {dmId} = useParams();
  const navigate = useNavigate();
  const dm = useDirectMessage(dmId!);
  const {publish} = useStompClient();
  const isCommunity = !!dm?.community;


  const {chats} = useChats()

  // For Attachments (Image, Video, etc)
  const [file, setFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState('');
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);


  const {admin: adminOrNull} = useAdmin();
  const admin = adminOrNull!

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileSelectRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [canScroll, setCanScroll] = useState(true);
  const [showAttachmentPopup, setShowPopup] = useState(false);
  const [text, setText] = useState("");
  const [selectType, setSelectType] = useState<'image' | 'audio' | 'document' | 'video'>('document');

  // For the Audio Recording
  const [recording, setRecording] = useState(false)
  const [audioURL, setAudioURL] = useState("")
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // For Calls
  const callClient = useStreamVideoClient()!;
  const callContext = useContext(CallContext);
  const call = useCall();

  // For Typing Indicators
  const {indicator, setTyping} = useTypingIndicator()
  const isTyping = indicator?.isTyping && indicator?.typer !== admin.id;

  

  const handleInput = (e: ChangeEvent<HTMLTextAreaElement> | string) => {
    setText( typeof e === 'string'? e: e.target.value);

    setTyping(dmId!, text.trim().length !== 0)

    if(showAttachmentPopup && !file){
      setShowPopup(false);
    }

    // Adjust the height dynamically
    const textarea = textareaRef.current;
    const maxHeight = 1.2 * 7 * 16;
    textarea!.style.height = "auto"; // Reset height to recalculate
    textarea!.style.height = `${Math.min(textarea!.scrollHeight, maxHeight)}px`;
    textarea!.style.overflowY = textarea!.scrollHeight > maxHeight ? "auto" : "hidden";
  };

  async function sendMessage(){
      const chat  = {message: text.trim() === ''? null:text, senderId:admin?.id} as Chat;

      if(file){
        chat.attachmentType = selectType;
      }

      console.log(chat);

      const send = await (file? sendAttachment(dmId!, file, chat, thumbnailBlob) :sendChat(dmId!, chat));

      if(send.status === 200){
        return send.data as ApiResponse;
      }

      console.error(send.data);

      throw new Error(send.data['message']);


  }

  const handleScroll =()=>{
    if(!listRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = listRef.current;

     // Calculate distance from the bottom
     const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);

     // Set `canScroll` to true if the user is close to the bottom (e.g., 100px away)
    setCanScroll(distanceFromBottom < 100);

  }

  const openAttachment = ()=>{
    if(!fileSelectRef.current) return;

    fileSelectRef.current.click();
  }

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>)=>{
    const files = e.target.files ?? [];
    setShowPopup(false)

    if(files.length <= 0) return;

    const selectedFile = files[0];

    /// If we're currently not trying to add documents,
    // We want to set the type to the type of the file we select if they are
    // audio, image, or video.
    // Else we don't select it and throw an error
    if(selectType !== 'document'){
      const type = selectedFile.type.substring(0, selectedFile.type.indexOf('/'));

      if(type.startsWith('application')){
        toast.error("Error Selecting File", {description:"You can only select documents if you specified them as documents"})
        return;
      }

      setSelectType(type as 'audio' | 'image' | 'video')
    }
    handleExtraction(selectedFile);
    setFile(selectedFile);
    console.log(selectedFile.type);
    console.log(selectedFile.size);
    
    
  }

  const handleExtraction = (_file: File)=>{
    // if(imageSrc !== ''){
    //   URL.revokeObjectURL(imageSrc);
    // }
    setImageSrc('');
    setThumbnailBlob(null);
    if(['image', 'video'].includes(selectType)){
      const url = URL.createObjectURL(_file);

      // If it's an image
      if(selectType === 'image'){
        setImageSrc(url);
        return;
      }

      // If it's a video
      const video = videoRef.current;

      console.log("Video is null: ", video === null);

      if(!video) return;

      video.src = url;

      video.onloadedmetadata = ()=>{
        console.log('Video metadata loaded. Ready state:', video.readyState);
        // To set it to a random time
        const dur = video.duration;
        console.log("Dur loaded", dur)
        video.currentTime = 0.5;
      }

      video.onseeked = ()=>{
        const canvas  = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        if(ctx){
          console.log("Creating thumbnail...")
          ctx.drawImage(video, 0,0, canvas.width, canvas.height);
          const thumbnailDataUrl = canvas.toDataURL('image/png', 0.6);
          console.log("Created thumbnail..");
          setImageSrc(thumbnailDataUrl);

          canvas.toBlob((blob)=>setThumbnailBlob(blob), 'image/png', 0.6);
          URL.revokeObjectURL(url);

        }
      }

        
      return;
    }
  }

  const getFileSize = ()=>{
    if(!file) return "";

    const size = file.size;

    const mb = size >= (1024 * 1024);

    const mbString = `${(size / (1024 * 1024)).toFixed(0)}MB`;
    const kbString = `${(size / (1024)).toFixed(0)}KB`;

    return mb ? mbString : kbString;
  }

  const getFileType = ()=>{
    if(!file) return '';

    const type = file.type;

    const indexOfSlash = type.indexOf("/")

    if(type.startsWith('application')){
      return type.substring(indexOfSlash+1)
    }
    return type.substring(0, indexOfSlash);
  }

  const fileTypes = ()=> {
    if(selectType === 'document'){
      return '*/*';
    }

    return `${selectType}/*`;
  }

  useEffect(()=>{
    if(!dm){
      toast.error("This DM seems to not be found");
      navigate(-1);
    }
  }, [dm])
  

  useEffect(()=>{
    if(!listRef.current) return;

    if(!canScroll) return;

    listRef.current.scrollTo({behavior:'smooth', top:listRef.current.scrollHeight});

  }, [chats, canScroll, isTyping])

  // useEffect(()=>{
  //   const a = setTimeout(async()=>{
  //     const unseenChats = chats.filter(chat=>chat.senderId !== admin?.id && !(chat.readReceipt as string[]).includes(admin!.id));
  //     for(const chat of unseenChats){
  //       await markChatAsRead(channelId!,chat.id, admin!.id )
  //     }
  //   }, 1000)

  //   return ()=> clearTimeout(a)
  // }, [chats])

  const sendMessageMutation = useMutation({
    mutationFn: sendMessage,
    onSuccess: (data)=>{
      setText('')
      setFile(null)
      setImageSrc('');
      setThumbnailBlob(null);
      textareaRef.current!.style.height = 'auto';
    },
    onError: (error)=>{
      const message = error.message;

      if(message.toLowerCase().includes('large')){
        toast.error("A Slight issue", {description:"This project currently allows max doc size of 10MB"})
        return;
      }

      toast.error("An Error Occurred", {description:message});


    }
  });

  const profileIcon = ()=>{
          if(!isCommunity){
              return <div className='w-[45px] h-[45px] rounded-circle overflow-hidden'>
              {dm?.profile && <img src={dm.profile} alt='Channel Photo' className='w-full h-full object-cover' />}
              {!dm?.profile&& <div className='w-full h-full flex items-center justify-center open-sans font-medium text-[15px] text-center' style={{backgroundColor:dm?.color}}>{(dm?.name ?? "Someone").split(' ').map(name=> name.charAt(0).toUpperCase()).slice(0, Math.min(2, (dm?.name ?? "Someone").split(' ').length))}</div>}
            </div>;
          }
  
          return <div className='w-[45px] h-[45px] relative'>
              {/* Community Photo */}
              <div className='w-[77%] h-[77%] absolute top-0 left-0 rounded-circle overflow-hidden'>
                  {dm?.community.communityProfile  && <img src={dm?.community.communityProfile} alt='Channel Photo' className='w-full h-full object-cover' />}
                  {!dm?.community.communityProfile && <div className='w-full h-full flex items-center justify-center open-sans font-medium text-[15px] text-center' style={{backgroundColor:dm?.community.color}}>{(dm?.community.communityName ?? "Someone").split(' ').map(name=> name.charAt(0).toUpperCase()).slice(0, Math.min(2, (dm.name ?? "Someone").split(' ').length))}</div>}
              </div>
  
              {/* DM Photo */}
              <div className='w-[86%] h-[86%] absolute border-[2.5px] border-tertiary z-10 bottom-[2px] right-0 rounded-circle overflow-hidden'>
                  {dm.profile && <img src={dm.profile} alt='Channel Photo' className='w-full h-full object-cover' />}
                  {!dm.profile&& <div className='w-full h-full flex items-center justify-center open-sans font-medium text-[15px] text-center' style={{backgroundColor:dm.color}}>{(dm.name ?? "Someone").split(' ').map(name=> name.charAt(0).toUpperCase()).slice(0, Math.min(2, (dm.name ?? "Someone").split(' ').length))}</div>}
              </div>;
  
          </div>
  }
  
  const dmName = ()=>{
      if(!isCommunity){
          return <p className='whitespace-nowrap font-bold text-ellipsis overflow-hidden'>{dm?.name}</p>
      }

      return <div className='flex w-full font-bold items-center justify-start gap-2'>
          <p className='text-white text-opacity-80'>{dm?.community.communityName ?? dm?.name}</p>
          <ArrowRight2 size={12} variant='Bold'/>
          <p>{dm.name}</p>

      </div>

  }

  const header = ()=>(
    <Link to={'details'} className='w-full cursor-pointer px-8 py-4 bg-transparent flex gap-7 items-center justify-center'>
      {profileIcon()}
      <div className='flex flex-col gap-0 flex-1 overflow-hidden'>
        {dmName()}
        <div style={{'--overlapping-outline-color':'#101010'} as React.CSSProperties & Record<string, string>} className='flex items-center justify-start gap-2'>
         {isCommunity && !isTyping && <>
            <OverlappingImages size={19} images={dm?.recipients.map(member => member.profile ?? {fullName: `${member.firstName} ${member.lastName}`, color: member.color ?? 'green'}) ?? []} />
            <p className='font-semibold text-xs raleway text-secondary'>{dm?.recipients.length} Member{dm?.recipients.length ===1?'':'s'}</p>
         </>}
         {!isCommunity && !isTyping && <p className='text-secondary open-sans text-xs'>Last seen at 7:10 AM</p>}
         {isTyping && <p className='text-blue open-sans text-xs font-bold'>{isCommunity? `${dm.recipients.find(dm => dm.id === indicator.typer)?.firstName} is typing..`: "Typing..."}</p>}
        </div>
      </div>
      {callChannel.isPending && !callChannel.variables.video && <FaSpinner className='animate-spin' />}
      {!callChannel.isPending && <div title={call? "Join Meet" : "Start a Meet"}><Video className={`${!(call && call.id.includes(dmId ?? ''))? 'text-white': 'text-green-500 animate-bounce'}`} onClick={(e)=>{e.stopPropagation();e.preventDefault();callChannel.mutate({video: false})}} variant='Bold' /></div>}
      {/* <Video onClick={(e)=>{e.stopPropagation();e.preventDefault();callChannel.mutate({video: false})}} variant='Bold' /> */}
    </Link>
  )

  const footer = ()=>(
    <div className={`w-full flex flex-col ${file?'bg-black': 'bg-transparent'} rounded-b-[18px] relative items-center justify-center overflow-hidden`}>
      <div className={`flex w-full min-h-0 items-center rounded-t-[18px] overflow-hidden rounded-b-[5px] rounded-bl-[18px] bg-black border-[5px] mb-1 border-tertiary sticky ${file? 'h-[100px] opacity-100 bottom-0 pointer-events-auto':'h-0 opacity-0 -bottom-3 pointer-events-none'} transition-all duration-500 ease`}>
        <div className='w-2 h-full bg-purple'/>
        <div className={`w-[100px] ${selectType === 'document'? 'bg-transparent':'bg-background'} h-full items-center justify-center flex mr-3 relative`}>
        {selectType === 'video' && <div className='w-full h-full bg-black absolute select-none items-center justify-center flex z-[1] bg-opacity-30'>
            <PlayCircle variant='Bold' size={25} />
          </div>}
          { selectType !== 'document' && <img src={imageSrc} alt={selectType} className='w-full h-full object-cover' />}
          {selectType === 'document' && <LottieWidget lottieAnimation={docsPurple} loop={true} className='w-[100%] h-[100%] object-cover' />}
        </div>
        <div className='flex flex-col select-none gap-1 flex-1 justify-center text-secondary'>
          <p className='text-white font-semibold whitespace-nowrap text-ellipsis'>{file?.name}</p>
          <p className='text-[13px]' >{getFileType()}</p>
          <p className='text-[13px] text-blue font-medium'>{getFileSize()}</p>
        </div>
        <CloseCircle onClick={()=>{
          setFile(null)
          setImageSrc('');
          setThumbnailBlob(null);
        }} className='text-white mr-3 cursor-pointer relative' size={28} variant='Bold'/>
        
      </div>
      <div className={`w-full px-8 py-4 bg-tertiary flex gap-7 z-[2] ${file?'': 'pt-[8px]'} items-center justify-center relative overflow-hidden`}>
        <EmojiHappy variant='Bold'/>

        {/* To handle file select. Don't remove */}
        <input type='file' onChange={handleFileSelect} ref={fileSelectRef} accept={fileTypes()} multiple={false} className='[display:none]' />

        <video ref={videoRef} className='[display:none]' />

        {filePopupMenu()}

        <textarea ref={textareaRef} value={text} onChange={handleInput} className='flex-1 select-text purple-scrollbar bg-transparent overflow-y-scroll resize-none scholarly-scrollbar' rows={1} placeholder="What's on your mind?" autoComplete='off' style={{overflowY:text.split("\n").length > 7 ? "auto" : "hidden", maxHeight:'calc(1.2em * 7)', lineHeight:'1.2em', resize:'none'}} />

        <div className={`flex gap-7 items-center justify-center ${!(text.trim().length !== 0 || file)? 'opacity-100':'opacity-0 fixed -z-50 right-8'} transition-all ease duration-1000`}>
          <div onClick={()=>setShowPopup(!showAttachmentPopup)} title='Add Attachment' className='cursor-pointer'>
            <PopupTarget id='attachment-icon'>
              <Paperclip size={28} />
            </PopupTarget>
          </div>

          {/* <div title='Send VN' className="cursor-pointer">
            <Microphone size={28} />
          </div> */}
        </div>

        <div className={`text-purple cursor-pointer transition-all ease duration-500 flex items-center justify-center ${text.trim().length !== 0 || file? 'w-[28px] opacity-100 ':'opacity-0 fixed -z-50 right-8 w-0'}`}>
          {!sendMessageMutation.isPending && <Send onClick={()=>sendMessageMutation.mutate()} variant='Bold' size={28} />}
          {sendMessageMutation.isPending && <FaSpinner className='animate-spin text-[16px] text-white' />}
        </div>
        
    </div>
    </div>
  )

  const filePopupMenu = ()=>(
    <PopupMenu
    className='p-[10px]'
      targetId='attachment-icon'
      show={showAttachmentPopup}
      onClose={()=>setShowPopup(false)}
      menus={[
        {item:"Image", icon:<Image />, onClick: ()=>{
          setSelectType('image');
          setTimeout(openAttachment, 1000)
        }},
        {item:"Video", icon: <VideoPlay />, onClick: ()=>{
          setSelectType('video');
          setTimeout(openAttachment, 1000)
        }},
        {item:"Audio", icon: <Music />,onClick: ()=>{
          setSelectType('audio');
          setTimeout(openAttachment, 1000)
        }},
        {item:"Document", icon: <DocumentText />, onClick: ()=>{
          setSelectType('document');
          setTimeout(openAttachment, 1000)
        }}
      ]}
    />
  )

  const lastReadIndex = chats.findIndex(chat => chat.readReceipt.length !== 2 && chat.senderId === admin.id);
  const chatBody = ()=>(
    <div className="w-full flex flex-1 relative bg-black overflow-hidden">
      <div ref={listRef} onScroll={handleScroll} className='flex w-full flex-1 gap-1 overflow-x-hidden overflow-y-scroll flex-col scroll-smooth pt-10 pb-3 px-4 scholarly-scrollbar'>
        
        {chats.map((chat, index)=>{
          const isFirstMessage = index === 0;
          const isLastMessage = index === chats.length-1;
          const isSender = chat.senderId === admin?.id;
          const readImages = (dm?.recipients ?? []).filter(member=> chat.readReceipt.includes(member.id) && member.id !== admin?.id).map(member => member.profile ?? {fullName: `${member.firstName} ${member.lastName}`, color: member.color ?? 'green'});
          const sender =  (dm?.recipients ?? []).find(member => member.id === chat.senderId);
          let sameSender = false;
          let firstTimeSender = false;
          let lastTimeSender = false;
          let differentDay = true;
          let differentDayBelow = false;

          const areSameDay = (date1:string, date2:string)=>{
            const a = new Date(date1);
            const b = new Date(date2);

            const day1 = Math.floor(a.getTime() / (1000 * 60 * 60 * 24));
            const day2 = Math.floor(b.getTime() / (1000 * 60 * 60 * 24));
            return day1 !== day2;
          }

          if(!isFirstMessage && !isLastMessage){
            sameSender = chat.senderId === chats[index-1].senderId;
            differentDayBelow = areSameDay(chats[index+1].timestamp, chat.timestamp);
          }

          if(!isFirstMessage){
            firstTimeSender = chat.senderId !== chats[index-1].senderId || chat.messageType !== chats[index-1].messageType;
            differentDay = areSameDay(chats[index-1].timestamp, chat.timestamp);
          }

          if(!isLastMessage){
            lastTimeSender = chat.senderId !== chats[index+1].senderId
          }
          else if(!isFirstMessage){
            lastTimeSender = chat.senderId !== chats[index-1].senderId
          }

          const readChat = {
            ...chat,
            readReceipt: [...chat.readReceipt, admin!.id]
          } as Chat;
          const readDM = {
            ...dm,
            latestMessage: readChat,
            unreadMessages:0,
          } as DirectMessage

          const markChat = ()=>{

            // We send to the user's chat & channel websocket that he's read the chat
            publish(`/chats/${dmId}`, JSON.stringify({
              message:'Chat Marked As Read',
              data: readChat
            }));
           publish(`/dms/${admin?.id}`, JSON.stringify({
                message:"Chat Marked As Read",
                data: readDM
            }));
            markChatAsRead(dmId!,chat.id, admin!.id )
          }


          return <ChatWidget 
            key={chat.id}
            chat={chat}
            read={chat.readReceipt.includes(admin?.id ?? '')}
            markAsRead={markChat}
            isLastRead={(index+1) === lastReadIndex || (lastReadIndex === -1 && chats.length-1 === index)}
            channelColor={!isCommunity? 'var(--purple)' :  dm?.color}
            sender={sender}
            isGroup={isCommunity}
            readImages={readImages}
            differentDay={differentDay}
            differentDayBelow={differentDayBelow}
            isSender={isSender}
            firstSender={firstTimeSender}
            lastMessageSent={isLastMessage}
            lastSender={lastTimeSender}
            sameSender={sameSender}
            />
        })}

        {/* Chat showing typing indicator */}
      <TypingWidget sender={dm!.recipients.find(user => user.id == indicator?.typer)} show={isTyping} />
      </div>


      {/* Icon That appears when it's time to scroll */}
      <div 
          onClick={()=>listRef.current?.scrollTo({behavior:'smooth', top:listRef.current?.scrollHeight})}
          className={`absolute left-[50%] z-[5] w-10 h-10 flex items-center justify-center rounded-circle bg-purple hover:bg-background transition-all ease-in-out duration-500 ${canScroll? 'opacity-20 -bottom-10' :'opacity-100 bottom-7'}`}>
          <ArrowDown2 size={25} variant='Bold' />
      </div>
    </div>
  )

  useEffect(()=>{
    console.log("Call Changed");
  }, [call])

  const callChannel = useMutation({
    mutationFn: async({video=true}: {video?:boolean})=>{
      const members = dm!.recipients.map((member)=>{
        return {
          user_id: member.id,
          custom:{
            color:member.color,
            firstName: member.firstName,
            lastName: member.lastName,
            profile: member.profile
          },
          role:member.role == 'admin'? 'admin' : 'user'
        }
      });
      const _call = callClient.call('default', dmId!+"-"+(new Date().getUTCSeconds()));

      // By default, whe joining call, camera and microphone is disabled.
      await _call.microphone.disable();
      await _call.camera.disable();

      


      await _call.join({
        create: true,
        ring:true,
        video:true,
        data:{
          custom:{
            name: dm?.name,
            id: dm?.id,
            color: dm?.color

          },
          members 
        }
      })

      return _call;
    },

    onSuccess: async (data)=>{
      toast.success("Call Created", {description:call?"Join the call":""});

      

    },

    onError: ({message})=>{
      console.error(message);
      toast.error("Couldn't Place Call", {description: message})
    }
  })

  return (
    <div onClick={()=>{
      if(showAttachmentPopup){
        setShowPopup(false)
      }
    }} className='h-full w-full bg-tertiary text-white border border-tertiary rounded-[18px] overflow-hidden'>
      <div className='flex flex-col h-full w-full bg-tertiary text-white border overflow-hidden border-tertiary rounded-[18px]'>
          {/* Header */}
          {header()}
          

          {/* Body */}
          {chatBody()}

          {/* Footer */}
          {footer()}
      </div>
      
    </div>
    
  )
}
